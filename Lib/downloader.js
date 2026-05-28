import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { getYtdlpPath, getYtdlpBaseArgs } from '../utils/ytdlpBinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOWNLOAD_DIR = path.join(__dirname, "..", "download");

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Detect platform from URL
 */
function detectPlatform(url) {
    if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
    if (/instagram\.com/.test(url)) return "instagram";
    if (/facebook\.com|fb\.watch|fb\.com/.test(url)) return "facebook";
    if (/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/.test(url)) return "tiktok";
    if (/twitter\.com|x\.com/.test(url)) return "twitter";
    if (/douyin\.com|v\.douyin\.com/.test(url)) return "douyin";
    return null;
}

/**
 * Download media using yt-dlp
 * @param {string} url - Media URL
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<{platform: string, filePath: string, title: string}>}
 */
export function downloadMedia(url, onProgress = null) {
    // Check for TikTok Photo/Slide (yt-dlp often fails, handled by V2)
    if (url.includes('tiktok.com') && url.includes('/photo/')) {
        throw new Error('TikTok Slide/Photo tidak didukung di AutoDL V1 (Silakan gunakan AutoDL V2).');
    }

    return new Promise((resolve, reject) => {
        const platform = detectPlatform(url);
        if (!platform) {
            return reject(new Error("Platform tidak didukung. Hanya YouTube, Instagram, Facebook, dan Douyin."));
        }

        const ytdlpCmd = getYtdlpPath();
        if (ytdlpCmd.includes(path.sep) && !fs.existsSync(ytdlpCmd)) {
            return reject(new Error("yt-dlp binary tidak ditemukan. Pastikan yt-dlp.exe ada di folder Lib/"));
        }

        const timestamp = Date.now();
        const output = path.join(DOWNLOAD_DIR, `${platform}_${timestamp}.%(ext)s`);

        // Build platform-specific args
        let extraArgs = "";
        if (platform === "twitter") {
            extraArgs = ' --extractor-args "twitter:api=syndication"';
        } else if (platform === "instagram") {
            extraArgs = ' --add-header "Referer: https://www.instagram.com/"';
        } else if (platform === "tiktok") {
            extraArgs = ' --add-header "Referer: https://www.tiktok.com/"';
        }

        const format = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/best[height<=720]/best';
        const cmd = `"${ytdlpCmd}" ${getYtdlpBaseArgs()} -f "${format}" --merge-output-format mp4 --no-playlist --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"${extraArgs} -o "${output}" "${url}"`;

        console.log(`[Downloader] Executing: ${platform}`);

        const process = exec(cmd, {
            windowsHide: true,
            maxBuffer: 50 * 1024 * 1024, // 50MB buffer
            timeout: 90000 // 90s timeout (balanced)
        });

        let errorOutput = '';

        // Capture stderr for progress/errors
        process.stderr?.on('data', (data) => {
            const output = data.toString();
            errorOutput += output;

            // Parse progress if callback provided
            if (onProgress) {
                const percentMatch = output.match(/(\d+\.?\d*)%/);
                if (percentMatch) {
                    onProgress(parseFloat(percentMatch[1]));
                }
            }
        });

        process.on('error', (err) => {
            console.error('[Downloader] Process error:', err.message);
            reject(new Error(`Gagal menjalankan yt-dlp: ${err.message}`));
        });

        process.on('exit', (code) => {
            if (code !== 0) {
                console.error('[Downloader] Exit code:', code);
                console.error('[Downloader] Error output:', errorOutput);

                // Parse common errors
                if (errorOutput.includes('Private video')) {
                    return reject(new Error('Video/Post private'));
                } else if (errorOutput.includes('Video unavailable')) {
                    return reject(new Error('Video tidak tersedia'));
                } else if (errorOutput.includes('Sign in')) {
                    return reject(new Error('Video memerlukan login'));
                } else {
                    return reject(new Error('Gagal download. Video mungkin private atau tidak tersedia.'));
                }
            }

            // Find the downloaded file
            try {
                const files = fs.readdirSync(DOWNLOAD_DIR)
                    .filter(f => f.startsWith(`${platform}_${timestamp}`))
                    .map(f => ({
                        name: f,
                        path: path.join(DOWNLOAD_DIR, f),
                        time: fs.statSync(path.join(DOWNLOAD_DIR, f)).mtime.getTime()
                    }))
                    .sort((a, b) => b.time - a.time);

                if (!files.length) {
                    return reject(new Error('File tidak ditemukan setelah download'));
                }

                const file = files[0];
                const stats = fs.statSync(file.path);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                console.log(`[Downloader] Downloaded: ${file.name} (${fileSizeMB}MB)`);

                // Check file size (100MB limit)
                if (stats.size > 100 * 1024 * 1024) {
                    fs.unlinkSync(file.path);
                    return reject(new Error(`File terlalu besar (${fileSizeMB}MB). Maksimal 100MB.`));
                }

                // Extract title from filename
                const title = file.name
                    .replace(`${platform}_${timestamp}.`, '')
                    .replace(/\.(mp4|mkv|webm)$/, '')
                    .substring(0, 100);

                resolve({
                    platform,
                    filePath: file.path,
                    title: title || 'Media',
                    size: fileSizeMB
                });

            } catch (err) {
                console.error('[Downloader] File search error:', err);
                reject(new Error('Gagal menemukan file hasil download'));
            }
        });
    });
}

/**
 * Clean up old files in download directory
 */
export function cleanupOldFiles() {
    try {
        const files = fs.readdirSync(DOWNLOAD_DIR);
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hour

        files.forEach(file => {
            const filePath = path.join(DOWNLOAD_DIR, file);
            const stats = fs.statSync(filePath);
            const age = now - stats.mtime.getTime();

            if (age > maxAge) {
                fs.unlinkSync(filePath);
                console.log(`[Downloader] Cleaned up old file: ${file}`);
            }
        });
    } catch (err) {
        console.error('[Downloader] Cleanup error:', err);
    }
}

export default {
    downloadMedia,
    cleanupOldFiles
};
