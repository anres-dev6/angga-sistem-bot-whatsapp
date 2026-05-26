/**
 * YouTube Downloader V1 - yt-dlp based
 * For manual command: .yt
 */

import { downloadVideo, downloadAudio, getVideoInfo } from '../../ytdlp.js';
import { autoCompress } from '../../compression.js';
import path from 'path';
import fs from 'fs';

export const engine = 'yt-dlp';
export const platform = 'youtube';

/**
 * Download YouTube video with specified quality
 */
export async function downloadYouTubeVideo(url, quality, sock, from, progressMsg) {
    const outputPath = path.join(process.cwd(), 'temp', `yt_${Date.now()}.mp4`);

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Download with yt-dlp
    await downloadVideo(url, `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`, outputPath);

    let stats = fs.statSync(outputPath);
    let fileSizeMB = stats.size / (1024 * 1024);

    // Auto compress if > 100MB
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
}

/**
 * Download YouTube audio
 */
export async function downloadYouTubeAudio(url, quality, sock, from, progressMsg) {
    const outputPath = path.join(process.cwd(), 'temp', `yt_${Date.now()}.mp3`);

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    await downloadAudio(url, quality, outputPath);

    let stats = fs.statSync(outputPath);
    let fileSizeMB = stats.size / (1024 * 1024);

    // Auto compress if > 25MB
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
 * Get video information
 */
export async function getInfo(url) {
    return await getVideoInfo(url);
}
