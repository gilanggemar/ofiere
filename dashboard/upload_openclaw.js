const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready - Uploading Config');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut('remote_openclaw.json', '/root/.openclaw/openclaw.json', (err) => {
            if (err) throw err;
            console.log('Uploaded remote_openclaw.json to /root/.openclaw/openclaw.json');

            console.log('Restarting OpenClaw...');
            conn.exec('systemctl restart openclaw.service || docker restart openclaw || pm2 restart all', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    console.log('Restart command finished');
                    conn.end();
                }).on('data', d => console.log('OUT:', d.toString())).stderr.on('data', d => console.log('ERR:', d.toString()));
            });
        });
    });
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
