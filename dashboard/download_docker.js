const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH Ready - Finding Backup Config');
    conn.exec(`ls -la /docker/openclaw-bvwc/data/.openclaw`, (err, stream) => {
        if (err) throw err;
        let out = '';
        stream.on('data', d => out += d);
        stream.on('close', () => {
            console.log("Directory contents:");
            console.log(out);

            // Download the backup if it exists, otherwise the main file
            let target = '/docker/openclaw-bvwc/data/.openclaw/openclaw.json.bak';
            if (!out.includes('openclaw.json.bak')) {
                target = '/docker/openclaw-bvwc/data/.openclaw/openclaw.json';
            }

            console.log('Downloading ' + target);
            conn.sftp((err, sftp) => {
                sftp.fastGet(target, 'docker_openclaw.json', (err) => {
                    if (err) throw err;
                    console.log('Downloaded successfully.');
                    conn.end();
                });
            });
        });
    });
}).connect({
    host: '76.13.193.227',
    port: 22,
    username: 'root',
    password: '@Dotexe1996host'
});
