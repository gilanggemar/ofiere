const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    const cmds = [
        // Check if port 63966 is accessible on the host
        'ss -tlnp | grep -E "63966|18789"',
        // Try curling the proxy port
        'curl -s -o /dev/null -w "HTTP_CODE=%{http_code}" http://127.0.0.1:63966 2>&1',
        // Check Tailscale funnel configuration
        'tailscale serve status 2>&1',
        // Check Docker port mapping
        'docker port openclaw-bvwc-openclaw-1 2>&1',
    ];

    const results = [];
    let idx = 0;
    const runNext = () => {
        if (idx >= cmds.length) {
            let output = '';
            for (let i = 0; i < results.length; i++) {
                output += `\n${'='.repeat(60)}\nCMD: ${cmds[i]}\n${'='.repeat(60)}\n${results[i]}\n`;
            }
            fs.writeFileSync('diag_final.txt', output);
            console.log('Done - see diag_final.txt');
            conn.end();
            return;
        }
        const cmd = cmds[idx];
        conn.exec(cmd, (err, stream) => {
            if (err) { results.push('Error: ' + err.message); idx++; runNext(); return; }
            let out = '';
            stream.on('data', d => out += d);
            stream.stderr.on('data', d => out += d);
            stream.on('close', () => { results.push(out || '(no output)'); idx++; runNext(); });
        });
    };
    runNext();
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
