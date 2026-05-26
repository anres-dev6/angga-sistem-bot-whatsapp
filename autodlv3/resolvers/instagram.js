import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

export default async function instagram(url, ctx) {
    let filePath = null;

    try {
        // Use yt-dlp via downloadMedia (same as .ig command)
        console.log('[AutoDL V3 - Instagram] Downloading:', url);

        const result = await downloadMedia(url);
        filePath = result.filePath;

        // Read file as buffer
        const buffer = fs.readFileSync(filePath);

        // Detect media type from file extension
        const isVideo = filePath.endsWith('.mp4') ||
            filePath.endsWith('.mkv') ||
            filePath.endsWith('.webm');

        // Cleanup file immediately after reading
        fs.unlinkSync(filePath);
        filePath = null;

        if (isVideo) {
            return {
                type: 'video',
                buffer: buffer, // Return buffer instead of URL
                url: null, // Will be replaced by buffer in sender
                filename: `ig_${Date.now()}.mp4`
            };
        } else {
            // Image post
            return {
                type: 'image-slide',
                images: [buffer], // Return buffer array
                private: false
            };
        }

    } catch (err) {
        // Cleanup on error
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch { }
        }

        // Parse yt-dlp errors for better user feedback
        let errorMsg = err.message;
        if (errorMsg.includes('private')) {
            errorMsg = 'Post/Reels private';
        } else if (errorMsg.includes('tidak tersedia')) {
            errorMsg = 'Post/Reels tidak tersedia';
        } else if (errorMsg.includes('memerlukan login')) {
            errorMsg = 'Post memerlukan login';
        }

        throw new Error(`Instagram: ${errorMsg}`);
    }
}
