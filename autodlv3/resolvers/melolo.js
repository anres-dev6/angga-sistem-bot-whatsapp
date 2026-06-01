import fetch from 'node-fetch';
import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

export default async function melolo(url) {
    console.log('[AutoDL V3 - Melolo] Resolving:', url);

    try {
        console.log('[Melolo] Hunting for media URL...');
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            redirect: 'follow',
            timeout: 15000
        });

        if (res.ok) {
            const html = await res.text();

            // 1. Try OpenGraph tags
            const ogVideo = html.match(/<meta property="og:video" content="([^"]+)"/i)
                         || html.match(/<meta property="og:video:secure_url" content="([^"]+)"/i);

            if (ogVideo?.[1]) {
                const downloadUrl = ogVideo[1].replace(/&amp;/g, '&');
                return {
                    type: 'video',
                    url: downloadUrl,
                    filename: `melolo_${Date.now()}.mp4`
                };
            }

            // 2. Hunt for mp4 and m3u8 direct links
            const matches = html.match(/https?:\/\/[^\s"'`<>]+?\.(?:mp4|m3u8)[^\s"'`<>]*/gi) || [];
            const cleanMatches = matches
                .map(v => v.replace(/\\u002F/g, '/').replace(/\\/g, ''))
                .filter(v => !v.includes('tracker') && !v.includes('analytics'));

            if (cleanMatches.length > 0) {
                const downloadUrl = cleanMatches[0];
                return {
                    type: 'video',
                    url: downloadUrl,
                    filename: `melolo_${Date.now()}.${downloadUrl.includes('.m3u8') ? 'm3u8' : 'mp4'}`
                };
            }
        }
    } catch (e) {
        console.warn('[Melolo] Media hunter failed, trying local yt-dlp...', e.message);
    }

    // 3. Fallback to local yt-dlp
    try {
        console.log('[Melolo] Trying local yt-dlp fallback...');
        const result = await downloadMedia(url);
        const buffer = fs.readFileSync(result.filePath);
        fs.unlinkSync(result.filePath);
        return {
            type: 'video',
            buffer,
            url: null,
            filename: `melolo_${Date.now()}.mp4`
        };
    } catch (e) {
        console.warn('[Melolo] yt-dlp failed:', e.message);
    }

    throw new Error('Melolo: Gagal mengekstrak video. Tautan mungkin tidak tersedia.');
}
