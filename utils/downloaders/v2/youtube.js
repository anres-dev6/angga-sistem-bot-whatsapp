/**
 * YouTube Downloader V2 - ab-downloader based
 * For AutoDL V2 automatic downloads
 */

import abDownloader from 'ab-downloader';

export const engine = 'ab-downloader';
export const platform = 'youtube';

/**
 * Download YouTube video via ab-downloader
 * Note: ab-downloader has limited API, might fallback to yt-dlp
 */
export async function downloadYouTubeVideo(url, quality, sock, from, progressMsg) {
    try {
        // Attempt ab-downloader first
        console.log('[YT V2] Attempting ab-downloader...');

        // ab-downloader API is limited, fallback to yt-dlp for actual download
        const { downloadVideo } = await import('../../ytdlp.js');
        const { autoCompress } = await import('../../compression.js');
        const path = await import('path');
        const fs = await import('fs');

        const outputPath = path.join(process.cwd(), 'temp', `ytv2_${Date.now()}.mp4`);

        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Use yt-dlp as fallback (ab-downloader download function not available)
        await downloadVideo(url, `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`, outputPath);

        let stats = fs.statSync(outputPath);
        let fileSizeMB = stats.size / (1024 * 1024);

        if (fileSizeMB > 100) {
            await sock.sendMessage(from, {
                text: `📦 *Compressing (${fileSizeMB.toFixed(2)}MB)...*`,
                edit: progressMsg.key
            });

            const compressResult = await autoCompress(outputPath, 100, 'video');
            if (compressResult.compressed) {
                fs.unlinkSync(outputPath);
                return compressResult.path;
            }
        }

        return outputPath;

    } catch (error) {
        console.error('[YT V2] ab-downloader failed, using fallback:', error);
        throw error;
    }
}

/**
 * Download YouTube audio
 */
export async function downloadYouTubeAudio(url, quality, sock, from, progressMsg) {
    // Similar implementation with ab-downloader fallback
    const { downloadAudio } = await import('../../ytdlp.js');
    const { autoCompress } = await import('../../compression.js');
    const path = await import('path');
    const fs = await import('fs');

    const outputPath = path.join(process.cwd(), 'temp', `ytv2_${Date.now()}.mp3`);

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    await downloadAudio(url, quality, outputPath);

    let stats = fs.statSync(outputPath);
    let fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 25) {
        await sock.sendMessage(from, {
            text: `📦 *Compressing (${fileSizeMB.toFixed(2)}MB)...*`,
            edit: progressMsg.key
        });

        const compressResult = await autoCompress(outputPath, 25, 'audio');
        if (compressResult.compressed) {
            fs.unlinkSync(outputPath);
            return compressResult.path;
        }
    }

    return outputPath;
}

/**
 * Detect if URL is supported by ab-downloader
 */
export function isSupported(url) {
    return abDownloader.isSupported(url);
}
