import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';

// A robust function to download a binary file, recursively following HTTP/HTTPS redirects (301/302)
function downloadFile(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
        https.get(fileUrl, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                if (!redirectUrl) {
                    return reject(new Error(`Failed to follow redirect: location header is missing.`));
                }
                return downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Server returned HTTP ${response.statusCode} for ${fileUrl}`));
            }

            const fileStream = fs.createWriteStream(outputPath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => {}); // Delete partial file
            reject(err);
        });
    });
}

/**
 * Ensures ./assets/fonts exists, downloads Anton and Noto Sans if missing, and
 * registers the fonts with Fontconfig prior to sharp/librsvg rendering.
 */
export async function setupFonts() {
    console.log("[FontHelper] 🚀 Starting font setup and validation...");
    const fontsDir = path.resolve('./assets/fonts');
    const cacheDir = path.join(fontsDir, 'cache');

    // Ensure directory structures exist
    if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
    }
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const antonPath = path.join(fontsDir, 'Anton-Regular.ttf');
    const notoPath = path.join(fontsDir, 'NotoSans-Bold.ttf');

    // Google Fonts stable direct-download binary raw URLs
    const antonUrl = 'https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf';
    const notoUrl = 'https://github.com/notofonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';

    // 1. Download Anton-Regular.ttf if not present or corrupted
    try {
        if (!fs.existsSync(antonPath) || fs.statSync(antonPath).size < 10000) {
            console.log("[FontHelper] 📥 Anton-Regular.ttf not found. Downloading...");
            await downloadFile(antonUrl, antonPath);
            console.log("[FontHelper] ✅ Anton-Regular.ttf downloaded successfully.");
        } else {
            console.log("[FontHelper] 👍 Anton-Regular.ttf is already present and validated.");
        }
    } catch (e) {
        console.error("[FontHelper] ❌ Failed to download Anton-Regular.ttf:", e.message);
    }

    // 2. Download NotoSans-Bold.ttf if not present or corrupted
    try {
        if (!fs.existsSync(notoPath) || fs.statSync(notoPath).size < 10000) {
            console.log("[FontHelper] 📥 NotoSans-Bold.ttf not found. Downloading...");
            await downloadFile(notoUrl, notoPath);
            console.log("[FontHelper] ✅ NotoSans-Bold.ttf downloaded successfully.");
        } else {
            console.log("[FontHelper] 👍 NotoSans-Bold.ttf is already present and validated.");
        }
    } catch (e) {
        console.error("[FontHelper] ❌ Failed to download NotoSans-Bold.ttf:", e.message);
    }

    // 3. Write absolute paths dynamically to fonts.conf to register fonts under Fontconfig
    try {
        const confContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
  <config></config>
</fontconfig>`;

        const confPath = path.join(fontsDir, 'fonts.conf');
        fs.writeFileSync(confPath, confContent, 'utf-8');

        // Dynamically set Fontconfig environment variables prior to loading sharp
        process.env.FONTCONFIG_PATH = fontsDir;
        process.env.FONTCONFIG_FILE = confPath;
        console.log(`[FontHelper] 🎨 Registered fonts directory dynamically: FONTCONFIG_PATH=${fontsDir}`);
    } catch (e) {
        console.error("[FontHelper] ❌ Failed to write fonts.conf registry:", e.message);
    }
}

/**
 * Validates which font files are successfully downloaded and available
 * @returns {object} status of fonts
 */
export function validateFonts() {
    const fontsDir = path.resolve('./assets/fonts');
    const antonPath = path.join(fontsDir, 'Anton-Regular.ttf');
    const notoPath = path.join(fontsDir, 'NotoSans-Bold.ttf');

    const isAntonValid = fs.existsSync(antonPath) && fs.statSync(antonPath).size > 10000;
    const isNotoValid = fs.existsSync(notoPath) && fs.statSync(notoPath).size > 10000;

    return {
        isAntonValid,
        isNotoValid
    };
}
