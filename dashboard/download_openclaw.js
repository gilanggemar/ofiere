const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready - Downloading Config');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastGet('/root/.openclaw/openclaw.json.bak.1', 'remote_openclaw.json', (err) => {
            if (err) throw err;
            console.log('Downloaded remote_openclaw.json successfully.');
            conn.end();
        });
    });
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
