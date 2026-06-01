import { downloadMedia } from '../../Lib/downloader.js';
import fetch from 'node-fetch';
import fs from 'fs';

export default async function facebook(url, ctx) {
    console.log('[AutoDL V3 - Facebook] Resolving:', url);

    // Strategy 1: btch-downloader (fbdown)
    try {
        console.log('[AutoDL V3 - Facebook] Trying btch-downloader...');
        const btch = await import('btch-downloader');
        if (btch && typeof btch.fbdown === 'function') {
            const res = await btch.fbdown(url);
            let downloadUrl = null;
            if (res && typeof res === 'object') {
                downloadUrl = res.HD || res.SD || res.Normal || res.url;
            } else if (typeof res === 'string') {
                downloadUrl = res;
            }

            if (downloadUrl && downloadUrl.startsWith('http')) {
                return {
                    type: 'video',
                    url: downloadUrl,
                    filename: `fb_${Date.now()}.mp4`
                };
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Facebook] btch-downloader failed:', e.message);
    }

    // Strategy 2: yt-dlp (most reliable fallback for FB)
    let filePath = null;
    try {
        console.log('[AutoDL V3 - Facebook] Trying yt-dlp:', url);
        const result = await downloadMedia(url);
        filePath = result.filePath;

        const buffer = fs.readFileSync(filePath);
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

    // Strategy 3: SnapSave API fallback (pre-existing fallback)
    try {
        console.log('[AutoDL V3 - Facebook] Trying SnapSave API fallback...');
        const apiUrl = `https://snapsave.app/action.php`;
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
        console.warn('[AutoDL V3 - Facebook] SnapSave API fallback failed:', apiErr.message);
    }

    // Strategy 4: Owner's Dashboard API fallback
    try {
        console.log('[AutoDL V3 - Facebook] Trying Owner API...');
        const res = await fetch(`https://api-g4nggaa.biz.id/api/download/facebook?url=${encodeURIComponent(url)}`, {
            timeout: 15000
        });
        if (res.ok) {
            const json = await res.json();
            if (json && json.result) {
                const downloadUrl = json.result.url || json.result.download_link || json.result;
                if (downloadUrl && downloadUrl.startsWith('http')) {
                    return {
                        type: 'video',
                        url: downloadUrl,
                        filename: `fb_${Date.now()}.mp4`
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Facebook] Owner API failed:', e.message);
    }

    throw new Error('Facebook: Gagal download. Tautan mungkin private atau tidak didukung.');
}
