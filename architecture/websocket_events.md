# SOP: WebSocket Events Protocol

## Overview
Communication between the Dashboard (Client) and OpenClaw Gateway (Server) occurs via JSON-RPC over WebSocket.

**Endpoint**: `ws://127.0.0.1:18789`

## 1. Connection Lifecycle

### Handshake (Client -> Server)
Must be the first message sent after connection.

```json
{
  "type": "req",
  "id": "handshake-1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "ofiere-dashboard",
      "version": "1.0",
      "platform": "browser",
      "mode": "gui"
    },
    "role": "operator",
    "auth": { "token": "bf373b5a..." }
  }
}
```

## 2. Outbound Commands (Client -> Server)

### Send Chat / Command
The primary method to instruct agents.

```json
{
  "type": "req",
  "id": "cmd-123",
  "method": "chat.send",
  "params": {
    "message": "Analyze the logs",
    "sessionKey": "agent:daisy-slack:ofiere:v1",
    "idempotencyKey": "uuid-v4"
  }
}
```

## 3. Inbound Events (Server -> Client)

### Agent Status Update
Received when an agent's state changes (e.g., IDLE -> WORKING).

```json
{
  "type": "event",
  "event": "agent",
  "payload": {
    "agentId": "daisy-slack",
    "status": "working",
    "currentTask": "Parsing logs..."
  }
}
```

### Chat Stream (Token Delta)
Real-time typing effect.

```json
{
  "type": "event",
  "event": "agent",
  "payload": {
    "stream": "assistant",
    "data": {
      "delta": "Checking directory..."
    },
    "sessionKey": "agent:daisy-slack:ofiere:v1"
  }
}
```

## Error Handling
- **Connection Lost**: Auto-reconnect with exponential backoff (1s, 2s, 4s... max 30s).
- **Handshake Fail**: Fatal error. Show "Authentication Failed" modal.
