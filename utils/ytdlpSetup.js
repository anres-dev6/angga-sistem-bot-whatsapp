import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensures yt-dlp binary is available.
 * Resolves path to either local download or global installation.
 * @returns {Promise<string>} Command name or absolute path to yt-dlp executable.
 */
export async function setupYtdlp() {
    const isWin = process.platform === 'win32';
    const libDir = path.join(__dirname, '../Lib');
    const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    const localPath = path.join(libDir, binaryName);

    // Ensure Lib directory exists
    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
    }

    // 1. Check if local binary exists
    if (fs.existsSync(localPath)) {
        console.log(chalk.green(`[YT-DLP] Local binary found at ${localPath}`));
        if (!isWin) {
            try {
                fs.chmodSync(localPath, '755');
            } catch (e) {
                console.error('[YT-DLP] Failed to chmod local binary:', e.message);
            }
        }
        return localPath;
    }

    // 2. Check if global binary is available in PATH
    try {
        const checkCmd = isWin ? 'where yt-dlp' : 'which yt-dlp';
        execSync(checkCmd, { stdio: 'ignore' });
        console.log(chalk.green('[YT-DLP] Global binary found in system PATH'));
        return 'yt-dlp';
    } catch (err) {
        console.log(chalk.yellow('[YT-DLP] Binary not found locally or in PATH. Starting download...'));
    }

    // 3. Download binary
    const url = isWin
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    console.log(chalk.cyan(`[YT-DLP] Downloading from ${url} ...`));
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log(chalk.green(`[YT-DLP] Downloaded successfully to ${localPath}`));

        if (!isWin) {
            try {
                fs.chmodSync(localPath, '755');
                console.log(chalk.green(`[YT-DLP] Set executable permission (chmod +x) for ${binaryName}`));
            } catch (e) {
                console.error('[YT-DLP] Failed to chmod downloaded binary:', e.message);
            }
        }

        return localPath;
    } catch (error) {
        console.error(chalk.red('[YT-DLP] Failed to download binary:'), error.message);
        console.log(chalk.yellow('[YT-DLP] Will attempt to use global "yt-dlp" command as fallback.'));
        return 'yt-dlp';
    }
}
