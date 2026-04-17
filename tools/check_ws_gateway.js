// Node.js v24+ has global WebSocket
if (typeof WebSocket === 'undefined') {
    console.error('❌ WebSocket is not defined. Ensure you are running Node.js v22+');
    process.exit(1);
}

const ws = new WebSocket('ws://127.0.0.1:18789');

const HANDSHAKE_ID = 'ofiere-handshake-1';
const TOKEN = 'ofiere-new-token-12345';

ws.onopen = () => {
    console.log('✅ WebSocket Connected');

    const handshakeMsg = {
        type: 'req',
        id: HANDSHAKE_ID,
        method: 'connect',
        params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
                id: 'cli',
                version: '1.0',
                platform: 'browser',
                mode: 'cli'
            },
            role: 'operator',
            auth: { token: TOKEN }
        }
    };

    console.log('Sending use handshake:', JSON.stringify(handshakeMsg, null, 2));
    ws.send(JSON.stringify(handshakeMsg));
};

ws.onmessage = (event) => {
    console.log('📩 Message Received:', event.data);
    try {
        const msg = JSON.parse(event.data);
        if (msg.id === HANDSHAKE_ID) {
            if (msg.error) {
                console.error('❌ Handshake Failed:', JSON.stringify(msg.error));
                process.exit(1);
            } else {
                console.log('✅ Handshake Successful!');

                // Try to list agents
                const listId = 'ofiere-list-agents';
                const listMsg = {
                    type: 'req',
                    id: listId,
                    method: 'agent.list',
                    params: {}
                };
                console.log('Requesting agent list...');
                ws.send(JSON.stringify(listMsg));
            }
        } else if (msg.id === 'ofiere-list-agents') {
            if (msg.error) {
                console.error('❌ List Agents Failed:', JSON.stringify(msg.error));
            } else {
                console.log('✅ Agents Found:', JSON.stringify(msg.result, null, 2));
            }
            ws.close();
            process.exit(0);
        }
    } catch (e) {
        console.error('⚠️ Failed to parse message:', event.data);
    }
};

ws.onerror = (error) => {
    console.error('❌ WebSocket Error:', error.message || error);
};

ws.onclose = () => {
    console.log('🔌 WebSocket Closed');
};

// Timeout
setTimeout(() => {
    console.error('❌ Timeout waiting for handshake response');
    process.exit(1);
}, 5000);
