import fetch from 'node-fetch';
import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

export default async function douyin(url) {
    console.log('[AutoDL V3 - Douyin] Resolving:', url);

    // Strategy 1: btch-downloader (douyin)
    try {
        console.log('[Douyin] Trying btch-downloader...');
        const btch = await import('btch-downloader');
        if (btch && typeof btch.douyin === 'function') {
            const res = await btch.douyin(url);
            if (res && typeof res === 'object') {
                const downloadUrl = res.video || res.url || res.download_link;
                if (downloadUrl && downloadUrl.startsWith('http')) {
                    return {
                        type: 'video',
                        url: downloadUrl,
                        filename: `douyin_${Date.now()}.mp4`
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[Douyin] btch-downloader failed:', e.message);
    }

    // Strategy 2: TikWM API (Supports Douyin URLs natively)
    try {
        console.log('[Douyin] Trying TikWM API...');
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&count=12&cursor=0&web=1&hd=1`;
        const res = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tikwm.com/'
            }
        });
        const json = await res.json();

        if (json.code === 0 && json.data) {
            const data = json.data;

            // Slide/Photo mode
            if (data.images && data.images.length > 0) {
                return {
                    type: 'image-slide',
                    images: data.images,
                    private: true,
                    filename: `douyin_slide_${data.id || Date.now()}`
                };
            }

            // Video mode
            const videoUrl = data.hdplay || data.play;
            if (videoUrl) {
                return {
                    type: 'video',
                    url: videoUrl.startsWith('http') ? videoUrl : `https://www.tikwm.com${videoUrl}`,
                    filename: `douyin_${data.id || Date.now()}.mp4`
                };
            }
        }
    } catch (e) {
        console.warn('[Douyin] TikWM failed:', e.message);
    }

    // Strategy 3: yt-dlp fallback
    try {
        console.log('[Douyin] Trying yt-dlp fallback...');
        const result = await downloadMedia(url);
        const filePath = result.filePath;
        const buffer = fs.readFileSync(filePath);
        fs.unlinkSync(filePath);
        return {
            type: 'video',
            buffer,
            url: null,
            filename: `douyin_${Date.now()}.mp4`
        };
    } catch (e) {
        console.warn('[Douyin] yt-dlp fallback failed:', e.message);
    }

    throw new Error('Douyin: Gagal mendownload media. Link mungkin private atau tidak valid.');
}
