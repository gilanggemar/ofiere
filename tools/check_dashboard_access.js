const WebSocket = require('ws');

const WS_URL = 'ws://127.0.0.1:18789';
const HANDSHAKE_ID = 'ofiere-dashboard-handshake-test';
const TOKEN = 'bf373b5a297c6dd2dddb89bf75585ac7dd0f17faa40b07ef';

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected to Gateway');

    const handshakeMsg = {
        type: 'req',
        id: HANDSHAKE_ID,
        method: 'connect',
        params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
                id: 'ofiere-dashboard',
                version: '1.0.0',
                platform: 'browser',
                mode: 'web' // Trying 'web' mode as 'dashboard' failed schema
            },
            role: 'operator', // Requesting 'operator' role, relying on token scopes for admin power
            auth: { token: TOKEN }
        }
    };

    console.log('Sending handshake with ID: ofiere-dashboard');
    ws.send(JSON.stringify(handshakeMsg));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('📩 Received:', JSON.stringify(msg, null, 2));

    if (msg.id === HANDSHAKE_ID) {
        if (msg.error) {
            console.error('❌ Handshake Failed:', msg.error);
            process.exit(1);
        } else {
            console.log('✅ Handshake Verified!');

            // Test Admin Scope
            const listMsg = {
                type: 'req',
                id: 'test-list-agents',
                method: 'agent.list',
                params: {}
            };
            ws.send(JSON.stringify(listMsg));
        }
    } else if (msg.id === 'test-list-agents') {
        if (msg.error) {
            console.error('❌ Admin Scope Check Failed:', msg.error);
            process.exit(1);
        } else {
            console.log('✅ Admin Scope Verified! Agents found:', msg.result?.length || 0);
            process.exit(0);
        }
    }
});

ws.on('error', (err) => {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
});
