const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready');
    const cmds = [
        'docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"',
        'cat /docker/openclaw-bvwc/docker-compose.yml',
        'cd /docker/openclaw-bvwc && docker compose up -d',
    ];

    let idx = 0;
    const runNext = () => {
        if (idx >= cmds.length) { conn.end(); return; }
        const cmd = cmds[idx++];
        console.log(`\n=== CMD: ${cmd} ===`);
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
