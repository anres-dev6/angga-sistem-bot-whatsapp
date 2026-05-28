import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getYtdlpPath() {
    if (global.ytdlpPath) return global.ytdlpPath;

    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const localPath = path.join(__dirname, '..', 'Lib', binaryName);

    if (fs.existsSync(localPath)) {
        global.ytdlpPath = localPath;
        return localPath;
    }

    return 'yt-dlp';
}

export function getYtdlpBaseArgs() {
    return [
        '--ignore-config',
        '--no-warnings',
        '--no-check-certificate',
        '--retries 3',
        '--fragment-retries 3',
        '--socket-timeout 30',
        '--extractor-args "youtube:player_client=default,ios"'
    ].join(' ');
}
