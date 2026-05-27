import { downloadMedia } from '../../Lib/downloader.js';
import fetch from 'node-fetch';
import fs from 'fs';

export default async function facebook(url, ctx) {
    let filePath = null;

    // Strategy 1: yt-dlp (most reliable for FB)
    try {
        console.log('[AutoDL V3 - Facebook] Trying yt-dlp:', url);
        const result = await downloadMedia(url);
        filePath = result.filePath;

        const buffer = fs.readFileSync(filePath);
        const isVideo = filePath.endsWith('.mp4') || filePath.endsWith('.mkv') || filePath.endsWith('.webm');
        fs.unlinkSync(filePath);
        filePath = null;

        return {
            type: 'video',
            buffer,
            url: null,
            filename: `fb_${Date.now()}.mp4`
        };

    } catch (ytdlpErr) {
        console.warn('[AutoDL V3 - Facebook] yt-dlp failed, trying API fallback:', ytdlpErr.message);
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch {}
            filePath = null;
        }
    }

    // Strategy 2: SnapSave API fallback
    try {
        const apiUrl = `https://snapsave.app/action.php`;
        const encoded = Buffer.from(url).toString('base64');

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Origin': 'https://snapsave.app',
                'Referer': 'https://snapsave.app/'
            },
            body: `url=${encodeURIComponent(url)}`
        });

        const text = await res.text();
        // Extract HD or SD url from snapsave response
        const hdMatch = text.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>HD/i);
        const sdMatch = text.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>SD/i);
        const videoUrl = hdMatch?.[1] || sdMatch?.[1];

        if (videoUrl) {
            return {
                type: 'video',
                url: videoUrl.replace(/&amp;/g, '&'),
                filename: `fb_${Date.now()}.mp4`
            };
        }
    } catch (apiErr) {
        console.warn('[AutoDL V3 - Facebook] API fallback failed:', apiErr.message);
    }

    throw new Error('Facebook: Gagal download. Link mungkin private atau tidak didukung.');
}
