const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready - Finding Config');
    conn.exec(`find / -name openclaw.json 2>/dev/null`, (err, stream) => {
        if (err) throw err;
        let out = '';
        stream.on('data', d => out += d);
        stream.on('close', () => {
            console.log("Found config files at:");
            console.log(out);
            conn.end();
        });
    });
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
