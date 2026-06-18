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
        // If we are on Termux / Android, shared storage is mounted noexec, so create a wrapper in app home
        if (process.platform === 'android' && (localPath.startsWith('/storage') || localPath.startsWith('/sdcard') || localPath.includes('shared'))) {
            const termuxHomeBinDir = '/data/data/com.termux/files/home/.cache/ytdlp_bin';
            const termuxHomeBinPath = path.join(termuxHomeBinDir, binaryName);
            
            try {
                if (!fs.existsSync(termuxHomeBinDir)) {
                    fs.mkdirSync(termuxHomeBinDir, { recursive: true });
                }
                
                const wrapperContent = `#!/data/data/com.termux/files/usr/bin/sh\nexec python3 "${localPath}" "$@"\n`;
                
                let needsWrite = true;
                if (fs.existsSync(termuxHomeBinPath)) {
                    const currentContent = fs.readFileSync(termuxHomeBinPath, 'utf8');
                    if (currentContent === wrapperContent) {
                        needsWrite = false;
                    }
                }
                
                if (needsWrite) {
                    console.log(`[YT-DLP Binary] Creating Termux executable wrapper: ${termuxHomeBinPath} -> ${localPath}`);
                    fs.writeFileSync(termuxHomeBinPath, wrapperContent, 'utf8');
                    fs.chmodSync(termuxHomeBinPath, 0o755);
                }
                
                global.ytdlpPath = termuxHomeBinPath;
                return termuxHomeBinPath;
            } catch (err) {
                console.error('[YT-DLP Binary] Failed to create executable wrapper in Termux:', err.message);
            }
        }

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
