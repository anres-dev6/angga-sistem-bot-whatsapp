import fetch from 'node-fetch';

export default async function instagram(url, ctx) {
    // Strategy 1: instasave API (snapinsta)
    try {
        console.log('[AutoDL V3 - Instagram] Trying snapinsta API:', url);

        const formData = new URLSearchParams({ url });
        const res = await fetch('https://snapinsta.app/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://snapinsta.app/',
                'Origin': 'https://snapinsta.app'
            },
            body: formData.toString()
        });

        if (res.ok) {
            const json = await res.json();
            if (json && json.url) {
                return {
                    type: 'video',
                    url: json.url,
                    filename: `ig_${Date.now()}.mp4`
                };
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] snapinsta failed:', e.message);
    }

    // Strategy 2: indown.io API
    try {
        const res = await fetch('https://indown.io/api/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({ link: url, locale: 'id', index: 0 })
        });

        if (res.ok) {
            const json = await res.json();
            if (json.url) {
                // Single video
                return {
                    type: 'video',
                    url: json.url,
                    filename: `ig_${Date.now()}.mp4`
                };
            }
            if (json.urls && Array.isArray(json.urls) && json.urls.length > 0) {
                // Multiple images (carousel)
                return {
                    type: 'image-slide',
                    images: json.urls,
                    private: false
                };
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] indown.io failed:', e.message);
    }

    // Strategy 3: yt-dlp via Lib/downloader.js
    try {
        console.log('[AutoDL V3 - Instagram] Trying yt-dlp...');
        const { downloadMedia } = await import('../../Lib/downloader.js');
        const fs = await import('fs');

        const result = await downloadMedia(url);
        const buffer = fs.default.readFileSync(result.filePath);
        const isVideo = result.filePath.endsWith('.mp4') || result.filePath.endsWith('.mkv') || result.filePath.endsWith('.webm');
        fs.default.unlinkSync(result.filePath);

        if (isVideo) {
            return { type: 'video', buffer, url: null, filename: `ig_${Date.now()}.mp4` };
        } else {
            return { type: 'image-slide', images: [buffer], private: false };
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] yt-dlp failed:', e.message);
    }

    throw new Error('Instagram: Gagal download. Post mungkin private atau tidak didukung.');
}
