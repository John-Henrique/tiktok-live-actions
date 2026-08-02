const fs = require('fs');
const path = require('path');
const envPath = path.join('E:\\tiktok-live\\backend-engine', '.env');
const envConfig = fs.readFileSync(envPath, 'utf8').split('\n');
envConfig.forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
});

const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function test() {
    try {
        console.log("Endpoint:", process.env.B2_ENDPOINT);
        console.log("Key ID (primeiros 4):", process.env.B2_KEY_ID ? process.env.B2_KEY_ID.substring(0, 4) : "MISSING");
        
        let endpoint = process.env.B2_ENDPOINT;
        if (endpoint && !endpoint.startsWith('http')) {
             endpoint = 'https://' + endpoint;
        }

        const s3Client = new S3Client({
            endpoint: endpoint,
            region: 'us-east-005', // ou a região do endpoint
            credentials: {
                accessKeyId: process.env.B2_KEY_ID,
                secretAccessKey: process.env.B2_APP_KEY
            }
        });
        
        const command = new ListBucketsCommand({});
        const res = await s3Client.send(command);
        console.log("Buckets:", res.Buckets.map(b => b.Name));
    } catch (e) {
        console.error("Erro S3:", e.message);
    }
}
test();
