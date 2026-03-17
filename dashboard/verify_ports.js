const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready');
    const cmds = [
        'ss -tlnp | grep -E "18789|63966"',
        'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"',
        'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:63966/ || echo "63966 unreachable"',
        'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/ || echo "18789 unreachable"',
    ];

    let idx = 0;
    const runNext = () => {
        if (idx >= cmds.length) { conn.end(); return; }
        const cmd = cmds[idx++];
        console.log(`\n=== ${cmd} ===`);
        conn.exec(cmd, (err, stream) => {
            if (err) { console.log('Error:', err.message); runNext(); return; }
            let out = '';
            stream.on('data', d => out += d);
            stream.stderr.on('data', d => out += d);
            stream.on('close', () => { console.log(out || '(no output)'); runNext(); });
        });
    };
    runNext();
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
