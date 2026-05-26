/**
 * Instagram Downloader V2 - ab-downloader based
 * For AutoDL V2 automatic downloads
 */

import abDownloader from 'ab-downloader';

export const engine = 'ab-downloader';
export const platform = 'instagram';

export async function downloadInstagramMedia(url, sock, from, progressMsg) {
    try {
        console.log('[IG V2] Using ab-downloader...');

        // Fallback to yt-dlp (ab-downloader API limitation)
        const { downloadVideo } = await import('../../ytdlp.js');
        const { autoCompress } = await import('../../compression.js');
        const path = await import('path');
        const fs = await import('fs');

        const outputPath = path.join(process.cwd(), 'temp', `igv2_${Date.now()}.mp4`);

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

    } catch (error) {
        console.error('[IG V2] Error:', error);
        throw error;
    }
}

export function isSupported(url) {
    return abDownloader.isSupported(url);
}
