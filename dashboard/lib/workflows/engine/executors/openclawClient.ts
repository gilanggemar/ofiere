import crypto from 'crypto';
import WebSocket from 'ws';

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sendOpenClawMessage(
  agentName: string,
  prompt: string,
  sessionKey: string = `agent:${agentName.toLowerCase()}:workflow`,
  timeoutMs: number = 60000
): Promise<string> {
  const wsUrl = process.env.NEXT_PUBLIC_OPENCLAW_WS_URL || 'wss://srv1335911.tailececae.ts.net';
  const token = process.env.OPENCLAW_AUTH_TOKEN || process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN || '';

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout;
    const ws = new WebSocket(wsUrl, {
      headers: {
        Origin: 'https://localhost:3000'
      }
    });
    let fullResponse = '';
    let agentRawText = '';  // Text from event:agent (contains <thinking> blocks)
    let chatContent = '';   // Clean text from event:chat message objects
    let resolved = false;
    
    const finish = (text?: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      
      // Prefer chatContent (clean, from chat events) over agentRawText (has <thinking>)
      let finalResponse = chatContent || text || agentRawText || 'Agent completed without text response.';
      
      // Strip <thinking>...</thinking> blocks if present
      finalResponse = finalResponse
        .replace(/<thinking[\s>][\s\S]*?<\/thinking>/gi, '')  // complete blocks
        .replace(/<\/thinking>/gi, '')                          // stray closing tags
        .replace(/^<thinking[\s>]?/i, '')                       // leading <thinking prefix (no closing tag)
        .trim();
      
      // If stripping left us empty (text was ALL thinking), try chatContent or fallback
      if (!finalResponse) {
        finalResponse = chatContent || 'Agent completed without text response.';
      }
      
      console.log(`[WF:OpenClaw] finish() → finalResponse (${finalResponse.length} chars): "${finalResponse.slice(0, 120)}"`);
      
      setTimeout(() => ws.close(), 500);
      resolve(finalResponse);
    };
    
    // Generate throwaway keys for this connection
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const rawPub = publicKey.export({ type: 'spki', format: 'der' });
    const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
    const justRawPub = rawPub.subarray(ED25519_SPKI_PREFIX.length);
    const pubBase64Url = base64UrlEncode(justRawPub);
    const deviceId = crypto.createHash('sha256').update(justRawPub).digest('hex');

    const CHAT_REQ_ID = crypto.randomUUID();
    let chatRunId: string | null = null;

    ws.onopen = () => {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          reject(new Error(`Timeout waiting for OpenClaw response after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data.toString());

      // ─── Debug logging: log every message type after handshake ───
      if (msg.event && msg.event !== 'connect.challenge' && msg.event !== 'tick' && msg.event !== 'health') {
        console.log(`[WF:OpenClaw] event=${msg.event} stream=${msg.payload?.stream || '-'} type=${msg.payload?.type || '-'} state=${msg.payload?.state || '-'}`);
        // For chat events, log the full message structure
        if (msg.event === 'chat' && msg.payload?.message) {
          console.log(`[WF:OpenClaw]   chat message: ${JSON.stringify(msg.payload.message).slice(0, 500)}`);
        }
        // For agent events with data, log data preview
        if (msg.event === 'agent' && msg.payload?.data) {
          const d = msg.payload.data;
          const preview = typeof d === 'string' ? d.slice(0, 100) : JSON.stringify(d).slice(0, 150);
          console.log(`[WF:OpenClaw]   agent data: ${preview}`);
        }
      }
      
      // Also log response frames
      if (msg.id === CHAT_REQ_ID) {
        console.log(`[WF:OpenClaw] chat.send response:`, JSON.stringify(msg).slice(0, 300));
      }

      if (msg.event === 'connect.challenge') {
        const nonce = msg.payload?.nonce || msg.nonce;
        const signedAt = Date.now();
        
        const scopes = ['operator.read', 'operator.write', 'chat.send', 'chat.history'];
        const clientId = 'openclaw-control-ui';
        const clientMode = 'cli';
        const platform = 'server';
        const deviceFamily = 'desktop';

        const payloadStr = [
          "v3",
          deviceId,
          clientId,
          clientMode,
          "operator",
          scopes.join(","),
          String(signedAt),
          token,
          nonce,
          platform,
          deviceFamily,
        ].join("|");
        
        let sigBase64Url = '';
        try {
          const sig = crypto.sign(null, Buffer.from(payloadStr), privateKey);
          sigBase64Url = base64UrlEncode(sig);
        } catch (e) {
          console.error("Failed to sign challenge", e);
        }

        ws.send(JSON.stringify({
          type: 'req',
          id: 'h-ed25519',
          method: 'connect',
          params: {
            minProtocol: 3, maxProtocol: 3,
            client: {
              id: clientId,
              version: "1.0.0",
              platform,
              mode: clientMode,
              deviceFamily,
            },
            device: { id: deviceId, publicKey: pubBase64Url, signature: sigBase64Url, signedAt, nonce },
            role: 'operator', auth: { token }, scopes
          }
        }));
      }

      // Handshake Complete
      if (msg.id === 'h-ed25519') {
        if (!msg.ok) {
          clearTimeout(timeoutId);
          ws.close();
          return reject(new Error('OpenClaw Handshake failed: ' + JSON.stringify(msg.error)));
        }
        
        // Subscribe to events
        ws.send(JSON.stringify({
          type: 'req',
          id: 'sub-1',
          method: 'event.subscribe',
          params: { events: ['*'] }
        }));
        
        // Send Chat
        ws.send(JSON.stringify({
          type: 'req',
          id: CHAT_REQ_ID,
          method: 'chat.send',
          params: {
            sessionKey,
            message: prompt,
            idempotencyKey: crypto.randomUUID()
          }
        }));
      }

      // Capture runId from chat.send response
      if (msg.id === CHAT_REQ_ID) {
        if (!msg.ok) {
          clearTimeout(timeoutId);
          ws.close();
          return reject(new Error('chat.send failed: ' + JSON.stringify(msg.error)));
        }
        // Store the runId returned by the gateway so we can track the correct run
        const result = msg.payload || msg.result || msg.data || msg;
        chatRunId = result?.runId || null;
        console.log(`[WF:OpenClaw] chat.send runId: ${chatRunId}`);
      }

      // ─── event:agent — capture thinking text and lifecycle ───
      if (msg.event === 'agent' && msg.payload) {
        const p = msg.payload;
        
        // Capture ALL assistant stream text (includes <thinking> blocks)
        if (p.stream === 'assistant') {
          let delta = '';
          if (typeof p.data === 'string') {
            delta = p.data;
          } else if (p.data) {
            delta = p.data.delta || p.data.text || '';
          }
          if (delta) agentRawText += delta;
        }

        // Lifecycle phase end → finish with best available text
        if (p.stream === 'lifecycle' && p.data?.phase === 'end') {
          console.log(`[WF:OpenClaw] Agent lifecycle end — agentRawText: ${agentRawText.length} chars, chatContent: ${chatContent.length} chars`);
          // Don't finish immediately — wait a short time for chat final event
          // which carries the clean response
          setTimeout(() => {
            if (!resolved) {
              console.log(`[WF:OpenClaw] Delayed finish — chatContent: ${chatContent.length} chars`);
              finish();
            }
          }, 2000);
        }
      }

      // ─── event:chat — extract clean response from message objects ───
      if (msg.event === 'chat' && msg.payload) {
        const cp = msg.payload;
        
        // Extract text from the message object
        if (cp.message) {
          let content = '';
          const msgObj = cp.message;
          
          // message.content can be a string or array of content blocks
          if (typeof msgObj.content === 'string') {
            content = msgObj.content;
          } else if (Array.isArray(msgObj.content)) {
            content = msgObj.content
              .filter((b: any) => b.type === 'text')
              .map((b: any) => b.text || '')
              .join('');
          } else if (typeof msgObj.content === 'object' && msgObj.content !== null) {
            content = msgObj.content.text || JSON.stringify(msgObj.content);
          }
          
          // Also check message.text directly
          if (!content && typeof msgObj.text === 'string') {
            content = msgObj.text;
          }
          
          // Update chatContent if this message has more text
          if (content && content.length > chatContent.length) {
            chatContent = content;
            console.log(`[WF:OpenClaw]   chatContent updated (${chatContent.length} chars): "${chatContent.slice(0, 120)}"`);
          }
        }
        
        // Also capture direct text/delta fields
        if (typeof cp.text === 'string' && cp.text) {
          if (cp.text.length > chatContent.length) chatContent = cp.text;
        } else if (typeof cp.delta === 'string' && cp.delta) {
          chatContent += cp.delta;
        }

        // Chat completion states
        const isDone = cp.state === 'done' || cp.state === 'final' || cp.type === 'message_end' || cp.type === 'done' 
          || cp.state === 'stop' || cp.done === true || cp.finished === true 
          || cp.state === 'complete' || cp.state === 'end';
        if (isDone) {
          console.log(`[WF:OpenClaw] Chat ${cp.state} — chatContent: ${chatContent.length} chars`);
          finish();
        }
      }
    };

    ws.onerror = (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(new Error('WebSocket error: ' + String(err)));
      }
    };
  });
}
