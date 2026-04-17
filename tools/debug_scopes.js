const WebSocket = require('ws');

const WS_URL = 'ws://127.0.0.1:18789';
const HANDSHAKE_ID = 'ofiere-debug-scopes';
const TOKEN = 'ofiere-new-token-12345';

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('🔌 Connected to Gateway');

    const handshakeMsg = {
        type: 'req',
        id: HANDSHAKE_ID,
        method: 'connect',
        params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
                id: 'openclaw-control-ui',
                displayName: 'Debug Script',
                version: '1.0.0',
                platform: 'terminal',
                mode: 'cli',
                instanceId: `debug-${Date.now()}`
            },

            auth: { token: TOKEN },
            scopes: [
                'operator.read',
                'operator.write',
                'operator.admin',
                'chat.send'
            ]
        }
    };

    console.log('Sending handshake:', JSON.stringify(handshakeMsg, null, 2));
    ws.send(JSON.stringify(handshakeMsg));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id === HANDSHAKE_ID) {
        if (msg.error) {
            console.error('❌ Handshake Error:', msg.error);
        } else {
            console.log('✅ Handshake Success');
            const scopes = msg.payload.scopes || msg.payload.grantedScopes || [];
            console.log('🔑 Granted Scopes:', JSON.stringify(scopes, null, 2));
            console.log('👤 Role:', msg.payload.role || 'unknown');
            if (!scopes.includes('operator.write')) {
                console.error('❌ MISSING operator.write scope!');
            } else {
                console.log('✅ operator.write scope present');
            }
        }
        ws.close();
    }
});

ws.on('error', (err) => {
    console.error('⚠️ WebSocket Error:', err.message);
});
