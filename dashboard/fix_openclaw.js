const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const results = [];

conn.on('ready', () => {
    console.log('SSH Ready - Fixing OpenClaw config inside Docker volume');

    const cmds = [
        // First, read the current config
        'cat /docker/openclaw-bvwc/data/.openclaw/openclaw.json',
    ];

    conn.exec(cmds[0], (err, stream) => {
        if (err) { console.log('Error:', err.message); conn.end(); return; }
        let configStr = '';
        stream.on('data', d => configStr += d);
        stream.on('close', () => {
            try {
                const config = JSON.parse(configStr);

                // FIX 1: Disable tailscale inside Docker (it runs on the host)
                config.gateway.tailscale = {
                    mode: "off",
                    resetOnExit: false
                };

                // FIX 2: Change bind from loopback to lan so Docker can expose the port
                config.gateway.bind = "lan";

                // FIX 3: Make sure gateway port is set
                config.gateway.port = 18789;

                // FIX 4: Add allowed origins for Vercel
                config.gateway.controlUi = config.gateway.controlUi || {};
                config.gateway.controlUi.allowedOrigins = [
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "https://nerv-phi.vercel.app",
                    "https://nerv-84nr198oy-gilanggemar.vercel.app",
                    "*"
                ];

                const newConfig = JSON.stringify(config, null, 2);
                console.log('\nNew gateway config section:');
                console.log(JSON.stringify(config.gateway, null, 2));

                // Write the fixed config back
                const writeCmd = `cat > /docker/openclaw-bvwc/data/.openclaw/openclaw.json << 'CONFIGEOF'
${newConfig}
CONFIGEOF`;

                conn.exec(writeCmd, (err, stream2) => {
                    if (err) { console.log('Write error:', err.message); conn.end(); return; }
                    let out = '';
                    stream2.on('data', d => out += d);
                    stream2.stderr.on('data', d => out += '[ERR] ' + d);
                    stream2.on('close', () => {
                        console.log('\nConfig written:', out || 'OK');

                        // Restart the Docker container
                        conn.exec('docker restart openclaw-bvwc-openclaw-1', (err, stream3) => {
                            if (err) { console.log('Restart error:', err.message); conn.end(); return; }
                            let rOut = '';
                            stream3.on('data', d => rOut += d);
                            stream3.stderr.on('data', d => rOut += d);
                            stream3.on('close', () => {
                                console.log('Restart result:', rOut || 'OK');

                                // Wait a moment, then check status
                                setTimeout(() => {
                                    conn.exec('docker logs openclaw-bvwc-openclaw-1 --tail 20 2>&1 && echo "---PORT CHECK---" && ss -tlnp | grep 18789', (err, stream4) => {
                                        if (err) { console.log('Check error:', err.message); conn.end(); return; }
                                        let cOut = '';
                                        stream4.on('data', d => cOut += d);
                                        stream4.stderr.on('data', d => cOut += d);
                                        stream4.on('close', () => {
                                            console.log('\nPost-restart status:\n' + cOut);
                                            conn.end();
                                        });
                                    });
                                }, 8000);
                            });
                        });
                    });
                });
            } catch (parseErr) {
                console.log('Failed to parse config:', parseErr.message);
                console.log('Raw config:', configStr.substring(0, 500));
                conn.end();
            }
        });
    });
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
