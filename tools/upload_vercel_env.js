const fs = require('fs');
const https = require('https');

const ENV_FILE = 'D:\\AI Model\\2-Antigravity Projects\\hecate\\dashboard\\.env.local'; // Update path if repo folder is renamed
const TOKEN = process.env.VERCEL_TOKEN || 'YOUR_VERCEL_TOKEN';
const PROJECT_ID = 'prj_umn49c6DV16uFohzLD0dYzJ0An71';
const TEAM_ID = 'team_DFjfeII8DrgoxxKvET5Teksh';

const content = fs.readFileSync(ENV_FILE, 'utf8');
const lines = content.split('\n');

const envs = [];
for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    const index = line.indexOf('=');
    if (index === -1) continue;

    const key = line.substring(0, index).trim();
    const value = line.substring(index + 1).trim();

    if (key && value) {
        envs.push({ key, value });
    }
}

async function addEnv(key, value) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            key: key,
            value: value,
            type: "encrypted",
            target: ["production", "preview", "development"]
        });

        const options = {
            hostname: 'api.vercel.com',
            path: '/v10/projects/' + PROJECT_ID + '/env?teamId=' + TEAM_ID,
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + TOKEN,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`✓ Added ${key}`);
                } else if (res.statusCode === 400 && data.includes('already exists')) {
                    console.log(`- Skipped ${key} (Expected: already exists from previous attempts)`);
                } else {
                    console.log(`x Failed to add ${key}. Status: ${res.statusCode}, Resp: ${data}`);
                }
                resolve();
            });
        });

        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
}

(async () => {
    console.log(`Found ${envs.length} env vars to upload...`);
    for (const { key, value } of envs) {
        await addEnv(key, value);
    }
    console.log("Upload complete.");
})();
