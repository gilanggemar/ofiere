// dashboard/lib/openclawGateway.ts
//
// Native WebSocket client implementing the OpenClaw Gateway protocol.
// Handles: connection, handshake (connect.challenge → connect),
// request/response correlation, and event dispatching.
//
// IMPORTANT: This is NOT Socket.io. OpenClaw uses raw WebSocket
// with JSON text frames following its own protocol.

type EventHandler = (payload: any) => void;
type ResponseCallback = {
  resolve: (payload: any) => void;
  reject: (error: any) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export interface OpenClawGatewayConfig {
  url: string;                    // e.g., "ws://127.0.0.1:18789"
  token?: string;                 // OPENCLAW_GATEWAY_TOKEN value (if set)
  clientId?: string;              // default: "nerv-dashboard"
  clientVersion?: string;         // default: "0.1.0"
  reconnectDelayMs?: number;      // default: 3000
  requestTimeoutMs?: number;      // default: 30000
}

export class OpenClawGateway {
  private ws: WebSocket | null = null;
  private config: Required<OpenClawGatewayConfig>;
  private pendingRequests: Map<string, ResponseCallback> = new Map();
  private eventListeners: Map<string, Set<EventHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalClose = false;
  private _isConnected = false;
  private _isHandshakeComplete = false;
  private challengeNonce: string | null = null;

  constructor(config: OpenClawGatewayConfig) {
    this.config = {
      url: config.url,
      token: config.token || "",
      clientId: config.clientId || "nerv-dashboard",
      clientVersion: config.clientVersion || "0.1.0",
      reconnectDelayMs: config.reconnectDelayMs || 3000,
      requestTimeoutMs: config.requestTimeoutMs || 30000,
    };
  }

  get isConnected(): boolean {
    return this._isConnected && this._isHandshakeComplete;
  }

  get isWebSocketOpen(): boolean {
    return this._isConnected;
  }

  // --- Public API ---

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log("[OpenClaw Gateway] WebSocket already connected or connecting. Skipping.");
      return;
    }

    if (this.ws) {
      this.ws.close();
    }
    this.isIntentionalClose = false;
    this._isConnected = false;
    this._isHandshakeComplete = false;

    try {
      this.ws = new WebSocket(this.config.url);
    } catch (err) {
      console.error("[OpenClaw Gateway] Failed to create WebSocket:", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("[OpenClaw Gateway] WebSocket opened, waiting for connect.challenge...");
      this._isConnected = true;
      this.emit("_ws_open", {});
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (event: Event) => {
      console.error("[OpenClaw Gateway] WebSocket error:", event);
      this.emit("_ws_error", { error: event });
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.log(`[OpenClaw Gateway] WebSocket closed: code=${event.code} reason=${event.reason}`);
      this._isConnected = false;
      this._isHandshakeComplete = false;
      this.rejectAllPending("Connection closed");
      this.emit("_ws_close", { code: event.code, reason: event.reason });
      this.emit("connection_status", { connected: false });

      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.isIntentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear out pending requests without throwing noisy unhandled rejections
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      // Suppress noisy rejected promises on intentional disconnect
      pending.resolve({ type: 'intentional-close', ok: false });
    }
    this.pendingRequests.clear();

    if (this.ws) {
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }

    this._isConnected = false;
    this._isHandshakeComplete = false;
  }

  /**
   * Reconfigure the gateway with new URL/token and reconnect.
   * Preserves all registered event listeners.
   */
  reconfigure(newUrl: string, newToken: string): void {
    console.log(`[OpenClaw Gateway] Reconfiguring: url=${newUrl}`);
    this.disconnect();
    this.config.url = newUrl;
    this.config.token = newToken || "";
    // Reconnect with new settings
    this.connect();
  }

  // Send a request and get a Promise for the response
  async request(method: string, params: Record<string, any> = {}): Promise<any> {
    if (!this._isConnected || !this.ws) {
      throw new Error("Not connected to OpenClaw Gateway");
    }

    const id = crypto.randomUUID();
    const frame = JSON.stringify({
      type: "req",
      id,
      method,
      params,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${this.config.requestTimeoutMs}ms`));
      }, this.config.requestTimeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws!.send(frame);
    });
  }

  /**
   * Send a raw frame over the WebSocket (for advanced/legacy use).
   * Returns the request id for response tracking.
   */
  sendRaw(frame: Record<string, any>): string {
    const id = frame.id || crypto.randomUUID();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...frame, id }));
    }
    return id;
  }

  // Register an event listener
  on(eventName: string, handler: EventHandler): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventName)?.delete(handler);
    };
  }

  // --- Internal ---

  private handleMessage(data: string): void {
    let frame: any;
    try {
      frame = JSON.parse(data);
    } catch (err) {
      console.error("[OpenClaw Gateway] Failed to parse frame:", data);
      return;
    }

    // Try to detect frame type from multiple possible field names
    const frameType = frame.type || frame.kind;

    // If it has an "event" field, treat it as an event regardless of type
    if (frame.event) {
      this.handleEvent(frame);
      return;
    }

    // If it has an "id" field and we have a pending request, treat as response
    if (frame.id && this.pendingRequests.has(frame.id)) {
      this.handleResponse(frame);
      return;
    }

    switch (frameType) {
      case "event":
        this.handleEvent(frame);
        break;

      case "res":
      case "response":
        this.handleResponse(frame);
        break;

      default:
        // Check if this looks like a challenge or hello
        if (frame.nonce || frame.challenge) {
          // Direct challenge frame without event wrapper
          this.challengeNonce = frame.nonce || frame.challenge;
          console.log("[OpenClaw Gateway] Got direct challenge nonce:", this.challengeNonce);
          this.performHandshake();
          return;
        }
        // Check if this is a hello-ok style response without type
        if (frame.ok !== undefined || frame.status === "ok" || frame.type === "hello-ok") {
          this.handleResponse({ ...frame, id: frame.id || "__handshake__", ok: frame.ok ?? true });
          return;
        }
        console.warn("[OpenClaw Gateway] Unknown frame format:", frame);
        this.emit("_raw_frame", frame);
    }
  }

  private handleEvent(frame: { event: string; payload?: any; data?: any; seq?: number;[key: string]: any }): void {
    const payload = frame.payload || frame.data || frame;

    // Handle the connect challenge (sent immediately after WS open)
    if (frame.event === "connect.challenge" || frame.event === "challenge") {
      this.challengeNonce = payload?.nonce || payload?.challenge || null;
      console.log("[OpenClaw Gateway] Challenge received, nonce:", this.challengeNonce);
      this.performHandshake();
      return;
    }

    // Dispatch to registered listeners — only log tool events to keep console clean
    if (frame.event === 'agent' && payload?.stream === 'tool') {
      console.log('[OpenClaw Gateway] Tool event:', JSON.stringify(payload).slice(0, 300));
    }
    this.emit(frame.event, payload);
  }

  private handleResponse(frame: { id: string; ok?: boolean; payload?: any; result?: any; data?: any; error?: any;[key: string]: any }): void {
    const responsePayload = frame.payload || frame.result || frame.data || frame;
    const isOk = frame.ok === true || frame.ok === undefined && !frame.error;

    const pending = this.pendingRequests.get(frame.id);
    if (!pending) {
      // This could be the handshake response or an untracked response
      const isHelloOk = responsePayload?.type === "hello-ok"
        || frame.type === "hello-ok"
        || responsePayload?.status === "connected"
        || responsePayload?.greeting;
      if (isHelloOk || (isOk && !this._isHandshakeComplete)) {
        this._isHandshakeComplete = true;
        console.log("[OpenClaw Gateway] Handshake complete:", JSON.stringify(responsePayload).slice(0, 300));
        this.emit("connection_status", { connected: true, handshake: responsePayload });
        this.emit("ready", responsePayload);
      }
      // Also emit as a generic response event for shim compatibility
      this.emit("_response", frame);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(frame.id);

    if (isOk) {
      pending.resolve(responsePayload);
    } else {
      pending.reject(frame.error || { message: "Unknown error" });
    }
  }

  // --- Device Identity Crypto Helpers ---

  private static readonly DEVICE_KEY_STORAGE = "nerv_openclaw_device_keypair";
  private static readonly DEVICE_ID_STORAGE = "nerv_openclaw_device_id";

  private static base64urlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private static base64urlDecode(str: string): Uint8Array {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  private async getOrCreateDeviceKeypair(): Promise<{
    publicKey: string;
    privateKey: CryptoKey;
    deviceId: string;
  }> {
    // Try to load from localStorage
    const stored = localStorage.getItem(OpenClawGateway.DEVICE_KEY_STORAGE);
    const storedId = localStorage.getItem(OpenClawGateway.DEVICE_ID_STORAGE);

    if (stored && storedId) {
      try {
        const parsed = JSON.parse(stored);
        const privateKey = await crypto.subtle.importKey(
          "jwk",
          parsed.privateKeyJwk,
          { name: "Ed25519" },
          false,
          ["sign"]
        );
        return { publicKey: parsed.publicKeyB64, privateKey, deviceId: storedId };
      } catch (err) {
        console.warn("[OpenClaw Gateway] Failed to load stored keypair, generating new one:", err);
      }
    }

    // Generate new Ed25519 keypair
    const keyPair = await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true, // extractable so we can store it
      ["sign", "verify"]
    );

    // Export public key as raw bytes → base64url
    const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const publicKeyB64 = OpenClawGateway.base64urlEncode(pubRaw);

    // Export private key as JWK for localStorage persistence
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

    // Generate a stable device ID (SHA-256 of public key)
    const idHash = await crypto.subtle.digest("SHA-256", pubRaw);
    const deviceId = Array.from(new Uint8Array(idHash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Persist
    localStorage.setItem(
      OpenClawGateway.DEVICE_KEY_STORAGE,
      JSON.stringify({ publicKeyB64, privateKeyJwk })
    );
    localStorage.setItem(OpenClawGateway.DEVICE_ID_STORAGE, deviceId);

    console.log("[OpenClaw Gateway] Generated new device keypair");
    console.log("[OpenClaw Gateway] Device ID:", deviceId);
    console.log("[OpenClaw Gateway] Public Key (base64url):", publicKeyB64);
    console.log("[OpenClaw Gateway] ⚠️ ADD THIS TO paired.json on the gateway!");

    return { publicKey: publicKeyB64, privateKey: keyPair.privateKey, deviceId };
  }

  private async signChallenge(params: {
    deviceId: string;
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    signedAtMs: number;
    token: string;
    nonce: string;
    platform: string;
    deviceFamily: string;
    privateKey: CryptoKey;
  }): Promise<{ signature: string }> {
    const payloadStr = [
      "v3",
      params.deviceId,
      params.clientId,
      params.clientMode,
      params.role,
      params.scopes.join(","),
      String(params.signedAtMs),
      params.token,
      params.nonce,
      params.platform,
      params.deviceFamily,
    ].join("|");

    const encoded = new TextEncoder().encode(payloadStr);

    const sig = await crypto.subtle.sign(
      { name: "Ed25519" },
      params.privateKey,
      encoded
    );

    return {
      signature: OpenClawGateway.base64urlEncode(sig),
    };
  }

  private async performHandshake(): Promise<void> {
    console.log("[OpenClaw Gateway] Performing handshake...");

    if (!this.challengeNonce) {
      console.warn("[OpenClaw Gateway] Cannot handshake without challenge nonce");
      return;
    }

    const { publicKey, privateKey, deviceId } = await this.getOrCreateDeviceKeypair();

    const signedAtMs = Date.now();
    const token = this.config.token || "";
    const scopes = [
        "operator.read",
        "operator.write",
        "operator.admin",
        "operator.approvals",
    ];

    const { signature } = await this.signChallenge({
      deviceId,
      clientId: "openclaw-control-ui",
      clientMode: "webchat",
      role: "operator",
      scopes,
      signedAtMs,
      token,
      nonce: this.challengeNonce,
      platform: "web",
      deviceFamily: "desktop",
      privateKey
    });

    const connectFrame = {
      type: "req",
      id: crypto.randomUUID(),
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-control-ui",
          version: "0.1.0",
          platform: "web",
          deviceFamily: "desktop",
          mode: "webchat",
        },
        device: {
          id: deviceId,
          publicKey,
          signature,
          signedAt: signedAtMs,
          nonce: this.challengeNonce,
        },
        role: "operator",
        scopes,
        caps: ["tool-events"],
        commands: [],
        permissions: {},
        auth: {
          token,
        },
        locale: "en-US",
        userAgent: "nerv-dashboard/0.1.0",
      },
    };

    // Store the request ID so we can catch the response
    const handshakeId = connectFrame.id;

    // Set up a pending request for the handshake response
    const handshakePromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(handshakeId);
        reject(new Error("Handshake timed out"));
      }, 10000);
      this.pendingRequests.set(handshakeId, { resolve, reject, timeout });
    });

    this.ws!.send(JSON.stringify(connectFrame));

    try {
      const helloOk = await handshakePromise;
      this._isHandshakeComplete = true;
      console.log("[OpenClaw Gateway] Handshake complete:", helloOk);
      this.emit("connection_status", { connected: true, handshake: helloOk });
      this.emit("ready", helloOk);
    } catch (err) {
      console.error("[OpenClaw Gateway] Handshake failed:", err);
      this.ws?.close(4001, "Handshake failed");
    }
  }

  private emit(eventName: string, payload: any): void {
    const handlers = this.eventListeners.get(eventName);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[OpenClaw Gateway] Error in ${eventName} handler:`, err);
        }
      }
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log(`[OpenClaw Gateway] Reconnecting in ${this.config.reconnectDelayMs}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectDelayMs);
  }
}

// ── Env var fallback (always available, no async) ──

const ENV_WS_URL =
    process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_OPENCLAW_WS_URL ||
    "";
const ENV_TOKEN =
    process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN || "";

export function getGatewayUrl(): string {
    if (ENV_WS_URL) return ENV_WS_URL;
    if (typeof window !== "undefined") {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${window.location.host}/api/openclaw-socket`;
    }
    return "ws://127.0.0.1:18789";
}

// ── Singleton ──

let gatewayInstance: OpenClawGateway | null = null;

export function getGateway(): OpenClawGateway {
    if (!gatewayInstance) {
        gatewayInstance = new OpenClawGateway({
            url: getGatewayUrl(),
            token: ENV_TOKEN,
        });
    }
    return gatewayInstance;
}
