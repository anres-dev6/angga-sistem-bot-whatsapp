import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import axios from 'axios';
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

async function downloadFileFromUrl(url, outputPath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(outputPath));
        writer.on('error', reject);
    });
}

async function tryDownloadInstagramApi(url, timestamp) {
    // 1. Try btch-downloader
    try {
        console.log('[Downloader - IG] Trying btch-downloader...');
        const btch = await import('btch-downloader');
        if (btch && typeof btch.igdl === 'function') {
            const res = await btch.igdl(url);
            let mediaUrl = null;
            if (Array.isArray(res)) {
                mediaUrl = res.find(v => v.url || v.download_link)?.url || res[0];
            } else if (res && typeof res === 'object') {
                if (res.result && Array.isArray(res.result)) {
                    mediaUrl = res.result[0]?.url || res.result[0]?.download_link;
                } else if (res.url) {
                    mediaUrl = res.url;
                } else if (res.result) {
                    mediaUrl = res.result;
                }
            } else if (typeof res === 'string') {
                mediaUrl = res;
            }

            if (mediaUrl && mediaUrl.startsWith('http')) {
                const ext = mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg') || mediaUrl.includes('.png') ? 'jpg' : 'mp4';
                const filePath = path.join(DOWNLOAD_DIR, `instagram_${timestamp}.${ext}`);
                await downloadFileFromUrl(mediaUrl, filePath);
                const stats = fs.statSync(filePath);
                return {
                    platform: 'instagram',
                    filePath,
                    title: 'Instagram Media',
                    size: (stats.size / (1024 * 1024)).toFixed(2)
                };
            }
        }
    } catch (err) {
        console.warn('[Downloader - IG] btch-downloader failed:', err.message);
    }

    // 2. Try Tiklydown API
    try {
        console.log('[Downloader - IG] Trying Tiklydown API...');
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        const response = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
            timeout: 15000
        });
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

        const json = response.data;
        let mediaUrl = null;
        if (json && json.result) {
            const result = json.result;
            if (Array.isArray(result)) {
                mediaUrl = result[0]?.url || result[0];
            } else if (result.video) {
                mediaUrl = mediaUrl = result.video;
            } else if (result.url) {
                mediaUrl = result.url;
            } else if (typeof result === 'string') {
                mediaUrl = result;
            }
        }

        if (mediaUrl && mediaUrl.startsWith('http')) {
            const ext = mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg') || mediaUrl.includes('.png') ? 'jpg' : 'mp4';
            const filePath = path.join(DOWNLOAD_DIR, `instagram_${timestamp}.${ext}`);
            await downloadFileFromUrl(mediaUrl, filePath);
            const stats = fs.statSync(filePath);
            return {
                platform: 'instagram',
                filePath,
                title: 'Instagram Media',
                size: (stats.size / (1024 * 1024)).toFixed(2)
            };
        }
    } catch (err) {
        console.warn('[Downloader - IG] Tiklydown failed:', err.message);
    }

    // 3. Try Owner's Dashboard API fallback
    try {
        console.log('[Downloader - IG] Trying Owner API...');
        const response = await axios.get(`https://api-g4nggaa.biz.id/api/download/instagram?url=${encodeURIComponent(url)}`, {
            timeout: 15000
        });
        const json = response.data;
        let mediaUrl = null;
        if (json && json.result) {
            mediaUrl = json.result.url || json.result.download_link || json.result;
        }

        if (mediaUrl && mediaUrl.startsWith('http')) {
            const ext = mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg') || mediaUrl.includes('.png') ? 'jpg' : 'mp4';
            const filePath = path.join(DOWNLOAD_DIR, `instagram_${timestamp}.${ext}`);
            await downloadFileFromUrl(mediaUrl, filePath);
            const stats = fs.statSync(filePath);
            return {
                platform: 'instagram',
                filePath,
                title: 'Instagram Media',
                size: (stats.size / (1024 * 1024)).toFixed(2)
            };
        }
    } catch (err) {
        console.warn('[Downloader - IG] Owner API failed:', err.message);
    }

    throw new Error('Instagram: Gagal mendownload media via API. Link mungkin private atau tidak valid.');
}

/**
 * Download media using yt-dlp
 * @param {string} url - Media URL
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<{platform: string, filePath: string, title: string}>}
 */
export async function downloadMedia(url, onProgress = null) {
    // Check for TikTok Photo/Slide (yt-dlp often fails, handled by V2)
    if (url.includes('tiktok.com') && url.includes('/photo/')) {
        throw new Error('TikTok Slide/Photo tidak didukung di AutoDL V1 (Silakan gunakan AutoDL V2).');
    }

    const platform = detectPlatform(url);
    if (!platform) {
        throw new Error("Platform tidak didukung. Hanya YouTube, Instagram, Facebook, dan Douyin.");
    }

    const timestamp = Date.now();

    // INTERCEPT INSTAGRAM TO USE API FALLBACK DIRECTLY (Bypasses local yt-dlp block)
    if (platform === 'instagram') {
        try {
            const result = await tryDownloadInstagramApi(url, timestamp);
            return result;
        } catch (apiErr) {
            console.warn('[Downloader - IG] API strategy failed, falling back to local yt-dlp...', apiErr.message);
            // Proceed to yt-dlp fallback
        }
    }

    return new Promise((resolve, reject) => {
        const ytdlpCmd = getYtdlpPath().replace(/\\/g, '/');
        if (ytdlpCmd.includes('/') && !fs.existsSync(ytdlpCmd)) {
            return reject(new Error("yt-dlp binary tidak ditemukan. Pastikan yt-dlp.exe ada di folder Lib/"));
        }

        const timestamp = Date.now();
        const output = path.join(DOWNLOAD_DIR, `${platform}_${timestamp}.%(ext)s`).replace(/\\/g, '/');

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

                // Check if it's a Python 3 not found error
                if (errorOutput.includes('python3') || errorOutput.includes('No such file or directory')) {
                    console.log('[Downloader] Python 3 not available, attempting API fallback for TikTok...');
                    if (platform === 'tiktok') {
                        return fallbackToTikTokAPI(url, resolve, reject);
                    }
                }

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
 * Fallback to TikTok API when Python 3 is not available
 */
async function fallbackToTikTokAPI(url, resolve, reject) {
    try {
        console.log('[Downloader] Trying TikTok API (TikWM)...');
        
        const response = await axios.get(`https://www.tikwm.com/api/`, {
            params: { url: url },
            timeout: 30000
        });

        if (response.data?.code === 0 && response.data?.data?.play) {
            const videoUrl = response.data.data.play;
            const title = response.data.data.title || "TikTok Video";
            
            console.log('[Downloader] TikWM API success, downloading video...');
            
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024
            });

            const videoBuffer = Buffer.from(videoResponse.data);
            const fileSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

            if (videoBuffer.length > 100 * 1024 * 1024) {
                return reject(new Error(`File terlalu besar (${fileSizeMB}MB). Maksimal 100MB.`));
            }

            const timestamp = Date.now();
            const filePath = path.join(DOWNLOAD_DIR, `tiktok_${timestamp}.mp4`);
            
            fs.writeFileSync(filePath, videoBuffer);

            resolve({
                platform: 'tiktok',
                filePath: filePath,
                title: title.substring(0, 100),
                size: fileSizeMB,
                source: 'tikwm_api'
            });
        } else {
            throw new Error('TikWM API response invalid');
        }
    } catch (err) {
        console.error('[Downloader] TikTok API fallback failed:', err.message);
        reject(new Error('Gagal download menggunakan yt-dlp dan API fallback. Silakan gunakan AutoDL V2.'));
    }
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
