// ============================================================
// Ofiere Workflow V2 — OpenClaw Workflow Adapter
// Uses server-side WebSocket (ws module) with proper HMAC handshake.
// Mirrors the same protocol used by the browser OpenClawGateway.
// ============================================================

import type {
  WorkflowAgentAdapter,
  WorkflowInvokeInput,
  WorkflowInvokeResult,
  AgentCapabilities,
  WorkflowStepEvent,
} from "../types";
import crypto from "crypto";

export class OpenClawWorkflowAdapter implements WorkflowAgentAdapter {
  private baseUrl: string;
  private wsToken: string;
  private userId?: string;

  constructor(connectionConfig: { baseUrl: string; wsToken: string; userId?: string }) {
    this.baseUrl = connectionConfig.baseUrl;
    this.wsToken = connectionConfig.wsToken;
    this.userId = connectionConfig.userId;
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return {
      invoke: true,
      stream: true,
      structuredOutput: true,
      cancel: false,
      pauseResume: false,
      humanCheckpoint: true,
      toolCallEvents: true,
    };
  }

  async invoke(input: WorkflowInvokeInput): Promise<WorkflowInvokeResult> {
    const startTime = Date.now();
    const events: WorkflowStepEvent[] = [];
    let chatContent = "";
    let agentRawText = "";

    // Dynamically import 'ws' for server-side WebSocket
    let WebSocketImpl: any;
    try {
      WebSocketImpl = (await import("ws")).default;
    } catch {
      // Fallback to global WebSocket if 'ws' is not available
      WebSocketImpl = globalThis.WebSocket;
    }

    if (!WebSocketImpl) {
      return {
        status: "failed",
        error: "No WebSocket implementation available (server-side)",
        events,
        usage: { durationMs: Date.now() - startTime },
      };
    }

    return new Promise<WorkflowInvokeResult>((resolve) => {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      let ws: any = null;
      let resolved = false;
      let handshakeComplete = false;

      const finish = (result: WorkflowInvokeResult) => {
        if (resolved) return;
        resolved = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        try { ws?.close(1000, "Step complete"); } catch {}
        resolve(result);
      };

      const finishSuccess = () => {
        let finalResponse = chatContent || agentRawText || "";
        let cleanText = finalResponse
          .replace(/<thinking[\s>][\s\S]*?<\/thinking>/gi, "")
          .replace(/<\/thinking>/gi, "")
          .replace(/^<thinking[\s>]?/i, "")
          .trim();
          
        if (!cleanText) {
          cleanText = chatContent || agentRawText || "Agent completed without text response.";
        }
        
        finish({
          status: "completed",
          outputText: cleanText.trim(),
          events,
          usage: { durationMs: Date.now() - startTime },
        });
      };

      // Timeout guard
      const timeoutSec = input.timeoutSec || 120;
      timeoutHandle = setTimeout(() => {
        finish({
          status: "timeout",
          error: `Agent did not respond within ${timeoutSec}s`,
          events,
          usage: { durationMs: Date.now() - startTime },
        });
      }, timeoutSec * 1000);

      try {
        // Build the WebSocket URL
        const wsUrl = this.baseUrl
          .replace(/^http:/, "ws:")
          .replace(/^https:/, "wss:");

        ws = new WebSocketImpl(wsUrl);

        ws.on?.("open", () => {
          console.log("[OpenClaw WF Adapter] WebSocket opened, waiting for challenge...");
        }) || (ws.onopen = () => {
          console.log("[OpenClaw WF Adapter] WebSocket opened, waiting for challenge...");
        });

        const handleMessage = async (rawData: any) => {
          const data = typeof rawData === "string" ? rawData : rawData.toString();
          let frame: any;
          try {
            frame = JSON.parse(data);
          } catch {
            return;
          }

          // ─── Handle HMAC Challenge ───
          if (frame.event === "connect.challenge" || frame.event === "challenge" || frame.nonce) {
            const nonce = frame.payload?.nonce || frame.data?.nonce || frame.nonce;
            if (nonce && this.wsToken) {
              // 1. Generate an ephemeral Ed25519 device keypair for this workflow run
              const keyPair = await globalThis.crypto.subtle.generateKey(
                { name: "Ed25519" },
                true,
                ["sign", "verify"]
              );

              // 2. Export public key and create a device ID
              const pubRaw = await globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey);
              const publicKeyB64 = Buffer.from(pubRaw).toString("base64url");
              
              const idHash = await globalThis.crypto.subtle.digest("SHA-256", pubRaw);
              const deviceId = Array.from(new Uint8Array(idHash))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");

              // 3. Construct signature payload (v3 protocol)
              const signedAtMs = Date.now();
              const payloadStr = [
                "v3",
                deviceId,
                "openclaw-control-ui",
                "webchat",
                "operator",
                "operator.read,operator.write,operator.admin,operator.approvals",
                String(signedAtMs),
                this.wsToken,
                nonce,
                "web",
                "desktop"
              ].join("|");

              // 4. Sign payload
              const encoded = new TextEncoder().encode(payloadStr);

              const _subtle = globalThis.crypto.subtle;
              const sigBytes = await _subtle.sign(
                { name: "Ed25519" },
                keyPair.privateKey,
                encoded
              );
              const signature = Buffer.from(sigBytes).toString("base64url");

              // 5. Build and send connect frame
              const connectFrame = {
                type: "req",
                id: "__handshake__",
                method: "connect",
                params: {
                  minProtocol: 3,
                  maxProtocol: 3,
                  client: {
                    id: "openclaw-control-ui",
                    version: "0.1.0",
                    platform: "web",
                    deviceFamily: "desktop",
                    mode: "webchat"
                  },
                  device: {
                    id: deviceId,
                    publicKey: publicKeyB64,
                    signature,
                    signedAt: signedAtMs,
                    nonce,
                  },
                  role: "operator",
                  scopes: [
                    "operator.read",
                    "operator.write",
                    "operator.admin",
                    "operator.approvals"
                  ],
                  caps: [],
                  commands: [],
                  permissions: {},
                  auth: { token: this.wsToken },
                  locale: "en-US",
                  userAgent: "ofiere-workflow/0.1.0"
                },
              };
              ws.send(JSON.stringify(connectFrame));
            }
            return;
          }

          // ─── Handle Handshake Response ───
          if (!handshakeComplete) {
            const isHandshakeRes = frame.id === "__handshake__" || frame.type === "hello-ok" || frame.status === "connected" || frame.greeting;
            
            if (isHandshakeRes) {
              if (frame.error || frame.ok === false) {
                return finish({
                  status: "failed",
                  error: `OpenClaw Handshake failed: ${JSON.stringify(frame.error || "Unknown error")}`,
                  events,
                  usage: { durationMs: Date.now() - startTime },
                });
              }
              handshakeComplete = true;
              console.log("[OpenClaw WF Adapter] Handshake complete, sending chat.send...");

              // We must subscribe to events to receive streaming replies from the agent
              ws.send(JSON.stringify({
                type: 'req',
                id: `sub-${input.stepId}`,
                method: 'event.subscribe',
                params: { events: ['*'] }
              }));

              // Use the requested workflow-isolated session key OR the provided override
              const agentNameStr = input.agentName ? input.agentName.toLowerCase() : input.agentId;
              const sessionKey = input.sessionKeyOverride || `agent:${agentNameStr}:nworkflow`;
              const reqId = `wf-${input.stepId}-${crypto.randomUUID()}`;

              const chatRequest = {
                type: "req",
                id: reqId,
                method: "chat.send",
                params: {
                  sessionKey,
                  message: input.task,
                  idempotencyKey: crypto.randomUUID(),
                },
              };
              ws.send(JSON.stringify(chatRequest));
              return;
            }
          }

          // ─── Handle chat.send response (runId assignment) ───
          if (frame.type === "res" && frame.id?.startsWith("wf-")) {
            const runId = frame.payload?.runId || frame.result?.runId;
            if (runId) {
              console.log(`[OpenClaw WF Adapter] Got gateway runId: ${runId}`);
            }
            return;
          }

          // ─── Handle streaming events ───
          const eventName = frame.event;
          const payload = frame.payload || frame.data || frame;

          if (eventName === "chat") {
            const isDone = payload.state === "done" || payload.state === "complete" ||
              payload.state === "end" || payload.done === true || payload.finished === true ||
              payload.type === "message_end" || payload.type === "done" || payload.state === "stop";

            // Extract text from the message object snapshot
            if (payload.message) {
              let content = "";
              const msgObj = payload.message;
              
              if (typeof msgObj.content === "string") {
                content = msgObj.content;
              } else if (Array.isArray(msgObj.content)) {
                content = msgObj.content
                  .filter((b: any) => b.type === "text")
                  .map((b: any) => b.text || "")
                  .join("");
              } else if (typeof msgObj.content === "object" && msgObj.content !== null) {
                content = msgObj.content.text || JSON.stringify(msgObj.content);
              }
              
              if (!content && typeof msgObj.text === "string") {
                content = msgObj.text;
              }
              
              if (content && content.length > chatContent.length) {
                chatContent = content;
              }
            }

            // Also capture direct text/delta fields
            if (typeof payload.text === "string" && payload.text) {
              if (payload.text.length > chatContent.length) {
                chatContent = payload.text;
              }
            } else if (typeof payload.delta === "string" && payload.delta) {
              chatContent += payload.delta;
            }

            if (isDone && (chatContent.trim() || agentRawText.trim())) {
              finishSuccess();
            } else if (isDone) {
              // Done but no text — might come later via lifecycle
            }

            // Handle errors in chat events
            if (payload.state === "error" || payload.error || payload.errorMessage) {
              finish({
                status: "failed",
                error: payload.errorMessage || payload.error?.message ||
                  (typeof payload.error === "string" ? payload.error : "Agent error"),
                events,
                usage: { durationMs: Date.now() - startTime },
              });
            }
          }

          if (eventName === "agent") {
            // Agent lifecycle events
            if (payload.stream === "lifecycle" && payload.data?.phase === "end") {
              // Agent finished — if we have text, return it
              if (chatContent.trim() || agentRawText.trim()) {
                setTimeout(() => {
                  if (!resolved) finishSuccess();
                }, 1000);
              }
            }

            // Agent assistant text stream
            if (payload.stream === "assistant") {
              const text = payload.data?.text || payload.data?.delta || "";
              if (text) agentRawText += text;
            }

            // Tool events
            if (payload.stream === "tools" || payload.type === "tool_call") {
              events.push({
                type: "tool_call",
                timestamp: new Date().toISOString(),
                data: payload.data || payload,
              });
            }
          }

          // Health events — ignore in workflow context
          if (eventName === "health") return;
        };

        // Support both EventEmitter (ws) and browser WebSocket
        if (ws.on) {
          ws.on("message", handleMessage);
          ws.on("error", (err: any) => {
            console.error("[OpenClaw WF Adapter] WS error:", err?.message || err);
            finish({
              status: "failed",
              error: `WebSocket error: ${err?.message || "connection failed"}`,
              events,
              usage: { durationMs: Date.now() - startTime },
            });
          });
          ws.on("close", (code: number, reason: any) => {
            if (!resolved) {
              if (chatContent.trim() || agentRawText.trim()) {
                finishSuccess();
              } else {
                finish({
                  status: "failed",
                  error: `WebSocket closed: code=${code} reason=${reason?.toString() || ""}`,
                  events,
                  usage: { durationMs: Date.now() - startTime },
                });
              }
            }
          });
        } else {
          // Browser WebSocket fallback
          ws.onmessage = (event: MessageEvent) => handleMessage(event.data);
          ws.onerror = () => {
            finish({
              status: "failed",
              error: "WebSocket connection error",
              events,
              usage: { durationMs: Date.now() - startTime },
            });
          };
          ws.onclose = (closeEvent: CloseEvent) => {
            if (!resolved) {
              if (chatContent.trim() || agentRawText.trim()) {
                finishSuccess();
              } else {
                finish({
                  status: "failed",
                  error: `WebSocket closed: code=${closeEvent.code} reason=${closeEvent.reason}`,
                  events,
                  usage: { durationMs: Date.now() - startTime },
                });
              }
            }
          };
        }
      } catch (e: any) {
        finish({
          status: "failed",
          error: e.message || "Failed to create WebSocket connection",
          events,
          usage: { durationMs: Date.now() - startTime },
        });
      }
    });
  }
}
