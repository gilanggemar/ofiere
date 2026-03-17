const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready');
    conn.exec('docker logs openclaw-bvwc-openclaw-1 --tail 50 2>&1', (err, stream) => {
        if (err) { console.log('Error:', err.message); conn.end(); return; }
        let out = '';
        stream.on('data', d => out += d);
        stream.stderr.on('data', d => out += d);
        stream.on('close', () => { console.log(out || '(no output)'); conn.end(); });
    });
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
