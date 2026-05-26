/**
 * Instagram Downloader V1 - yt-dlp based
 * For manual command: .ig
 */

import { downloadVideo } from '../../ytdlp.js';
import { autoCompress } from '../../compression.js';
import path from 'path';
import fs from 'fs';

export const engine = 'yt-dlp';
export const platform = 'instagram';

export async function downloadInstagramMedia(url, sock, from, progressMsg) {
    const outputPath = path.join(process.cwd(), 'temp', `ig_${Date.now()}.mp4`);

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    await downloadVideo(url, 'best', outputPath);

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
}
