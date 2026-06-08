import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getYtdlpPath, getYtdlpBaseArgs } from './ytdlpBinary.js';

const execAsync = promisify(exec);

/**
 * Get video information using yt-dlp
 * @param {string} url - Video URL
 * @returns {Promise<object>} Video metadata
 */
export async function getVideoInfo(url) {
    try {
        const ytdlpCmd = getYtdlpPath().replace(/\\/g, '/');
        const cmd = `"${ytdlpCmd}" ${getYtdlpBaseArgs()} --dump-json "${url}"`;
        const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
        return JSON.parse(stdout);
    } catch (error) {
        console.error('[YT-DLP] Error getting video info:', error);
        throw new Error('Failed to get video information');
    }
}

/**
 * Get available video formats
 * @param {string} url - Video URL
 * @returns {Promise<object>} Available formats
 */
export async function getAvailableFormats(url) {
    try {
        const info = await getVideoInfo(url);

        // Filter and organize formats
        const videoFormats = info.formats
            .filter(f => f.vcodec !== 'none' && f.height)
            .sort((a, b) => (b.height || 0) - (a.height || 0));

        const audioFormats = info.formats
            .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
            .sort((a, b) => (b.abr || 0) - (a.abr || 0));

        // Get common resolutions
        const commonResolutions = ['360', '480', '720', '1080', '1440', '2160'];
        const availableVideo = [];

        for (const res of commonResolutions) {
            const format = videoFormats.find(f => f.height && f.height.toString() === res);
            if (format) {
                availableVideo.push({
                    format_id: format.format_id,
                    resolution: `${format.height}p`,
                    ext: format.ext,
                    filesize: format.filesize || format.filesize_approx || 0,
                    fps: format.fps,
                    vcodec: format.vcodec
                });
            }
        }

        return {
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            uploader: info.uploader,
            view_count: info.view_count,
            video: availableVideo,
            audio: audioFormats.slice(0, 3).map(f => ({
                format_id: f.format_id,
                ext: f.ext,
                abr: f.abr,
                acodec: f.acodec
            }))
        };
    } catch (error) {
        console.error('[YT-DLP] Error getting formats:', error);
        throw error;
    }
}

/**
 * Download video with specific format
 * @param {string} url - Video URL
 * @param {string} formatId - Format ID
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Downloaded file path
 */
export async function downloadVideo(url, formatId, outputPath) {
    try {
        // Use format with best audio
        const ytdlpCmd = getYtdlpPath().replace(/\\/g, '/');
        const safeOutputPath = outputPath.replace(/\\/g, '/');
        const cmd = `"${ytdlpCmd}" ${getYtdlpBaseArgs()} -f "${formatId}+bestaudio/best" --merge-output-format mp4 -o "${safeOutputPath}" "${url}"`;
        console.log('[YT-DLP] Downloading video:', cmd);

        await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });
        return outputPath;
    } catch (error) {
        console.error('[YT-DLP] Error downloading video:', error);
        throw new Error('Failed to download video');
    }
}

/**
 * Download audio only
 * @param {string} url - Video URL
 * @param {string} quality - Audio quality (128, 192, 256, 320)
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Downloaded file path
 */
export async function downloadAudio(url, quality = '192', outputPath) {
    try {
        const ytdlpCmd = getYtdlpPath().replace(/\\/g, '/');
        const safeOutputPath = outputPath.replace(/\\/g, '/');
        const cmd = `"${ytdlpCmd}" ${getYtdlpBaseArgs()} -x --audio-format mp3 --audio-quality ${quality}K -o "${safeOutputPath}" "${url}"`;
        console.log('[YT-DLP] Downloading audio:', cmd);

        await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });

        // yt-dlp adds .mp3 extension
        const mp3Path = outputPath.replace(/\.[^.]+$/, '.mp3');
        return mp3Path;
    } catch (error) {
        console.error('[YT-DLP] Error downloading audio:', error);
        throw new Error('Failed to download audio');
    }
}

/**
 * Download thumbnail
 * @param {string} url - Video URL
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Downloaded thumbnail path
 */
export async function downloadThumbnail(url, outputPath) {
    try {
        const ytdlpCmd = getYtdlpPath().replace(/\\/g, '/');
        const safeOutputPath = outputPath.replace(/\\/g, '/');
        const cmd = `"${ytdlpCmd}" ${getYtdlpBaseArgs()} --write-thumbnail --skip-download -o "${safeOutputPath}" "${url}"`;
        await execAsync(cmd);

        // Find the downloaded thumbnail
        const dir = path.dirname(outputPath);
        const base = path.basename(outputPath, path.extname(outputPath));
        const files = fs.readdirSync(dir);
        const thumb = files.find(f => f.startsWith(base) && /\.(jpg|png|webp)$/.test(f));

        return thumb ? path.join(dir, thumb) : null;
    } catch (error) {
        console.error('[YT-DLP] Error downloading thumbnail:', error);
        throw new Error('Failed to download thumbnail');
    }
}

/**
 * Download subtitle
 * @param {string} url - Video URL
 * @param {string} lang - Language code (e.g., 'en', 'id')
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Downloaded subtitle path
 */
export async function downloadSubtitle(url, lang = 'en', outputPath) {
    try {
        const ytdlpCmd = getYtdlpPath().replace(/\\/g, '/');
        const safeOutputPath = outputPath.replace(/\\/g, '/');
        const cmd = `"${ytdlpCmd}" ${getYtdlpBaseArgs()} --write-sub --sub-lang ${lang} --skip-download -o "${safeOutputPath}" "${url}"`;
        await execAsync(cmd);

        const srtPath = outputPath.replace(/\.[^.]+$/, `.${lang}.srt`);
        return fs.existsSync(srtPath) ? srtPath : null;
    } catch (error) {
        console.error('[YT-DLP] Error downloading subtitle:', error);
        throw new Error('Failed to download subtitle');
    }
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Download video using yt-dlp (helper for V2 quality selection)
 */
export async function downloadYTDLP(url, quality) {
    const timestamp = Date.now();
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const outputPath = path.join(tempDir, `yt_${timestamp}.mp4`);
    const formatId = `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}]`;
    
    await downloadVideo(url, formatId, outputPath);
    
    const stats = fs.statSync(outputPath);
    const fileSize = formatFileSize(stats.size);
    return {
        filePath: outputPath,
        fileSize
    };
}

/**
 * Download audio using yt-dlp (helper for V2 quality selection)
 */
export async function downloadYTDLPAudio(url, quality = '128') {
    const timestamp = Date.now();
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const outputPath = path.join(tempDir, `yt_${timestamp}.mp3`);
    
    const mp3Path = await downloadAudio(url, quality, outputPath);
    
    const stats = fs.statSync(mp3Path);
    const fileSize = formatFileSize(stats.size);
    return {
        filePath: mp3Path,
        fileSize
    };
}
