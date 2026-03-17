const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready');
    conn.exec(`cat ~/.openclaw/openclaw.json`, (err, stream) => {
        if (err) throw err;
        let content = '';
        stream.on('data', d => content += d);
        stream.on('close', () => {
            console.log("----- CURRENT CONFIG ON DISK -----");
            try {
                const clean = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
                const parsed = JSON.parse(clean);
                console.log(JSON.stringify(parsed.gateway, null, 2));
            } catch (e) {
                console.log("Error parsing JSON:", e.message);
                console.log("Raw config snippet:", content.substring(0, 500));
            }
            conn.end();
        });
    });
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
