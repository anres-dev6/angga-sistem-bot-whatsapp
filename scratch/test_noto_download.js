import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';

function downloadFile(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
        https.get(fileUrl, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download. Status: ${response.statusCode}`));
            }
            const fileStream = fs.createWriteStream(outputPath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function run() {
    const outputPath = path.resolve('./assets/fonts/NotoSans-Bold.ttf');
    const notoUrl = 'https://github.com/notofonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';
    
    console.log(`Downloading Noto Sans Bold to ${outputPath}...`);
    try {
        await downloadFile(notoUrl, outputPath);
        console.log(`✅ Success! File size: ${fs.statSync(outputPath).size} bytes`);
    } catch (e) {
        console.error("❌ Failed:", e.message);
    }
}

run();
