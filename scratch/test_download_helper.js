import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';

// A robust function to download a file, following redirects (HTTP 301/302)
function downloadFile(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(fileUrl);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        };

        https.get(fileUrl, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                console.log(`Redirecting to: ${response.headers.location}`);
                return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download font. Status Code: ${response.statusCode}`));
            }

            const fileStream = fs.createWriteStream(outputPath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Successfully downloaded: ${outputPath}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => {}); // Delete partial file
            reject(err);
        });
    });
}

async function run() {
    console.log("=== STARTING FONT HELPER PROTO-TEST ===");
    const fontsDir = path.resolve('./assets/fonts');
    const cacheDir = path.join(fontsDir, 'cache');

    if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
    }
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const antonPath = path.join(fontsDir, 'Anton-Regular.ttf');
    const notoPath = path.join(fontsDir, 'NotoSans-Bold.ttf');

    // URLs for Anton and Noto Sans Bold
    const antonUrl = 'https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf';
    const notoUrl = 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Bold.ttf';

    try {
        if (!fs.existsSync(antonPath) || fs.statSync(antonPath).size < 10000) {
            console.log("Downloading Anton-Regular.ttf...");
            await downloadFile(antonUrl, antonPath);
        } else {
            console.log("Anton-Regular.ttf already exists and is valid.");
        }

        if (!fs.existsSync(notoPath) || fs.statSync(notoPath).size < 10000) {
            console.log("Downloading NotoSans-Bold.ttf...");
            await downloadFile(notoUrl, notoPath);
        } else {
            console.log("NotoSans-Bold.ttf already exists and is valid.");
        }

        // Validate files
        const isAntonValid = fs.existsSync(antonPath) && fs.statSync(antonPath).size > 10000;
        const isNotoValid = fs.existsSync(notoPath) && fs.statSync(notoPath).size > 10000;

        console.log(`Anton font validation: ${isAntonValid ? 'PASSED' : 'FAILED'}`);
        console.log(`Noto Sans font validation: ${isNotoValid ? 'PASSED' : 'FAILED'}`);

        // Write fonts.conf
        const confContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
  <config></config>
</fontconfig>`;

        const confPath = path.join(fontsDir, 'fonts.conf');
        fs.writeFileSync(confPath, confContent, 'utf-8');
        console.log("Generated fonts.conf successfully.");

    } catch (error) {
        console.error("Font Helper Test Failed:", error);
    }
}

run();
