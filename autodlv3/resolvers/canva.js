import fetch from 'node-fetch';

export default async function canva(url) {
    console.log('[AutoDL V3 - Canva] Resolving:', url);

    try {
        console.log('[Canva] Fetching and parsing public shared design page...');
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            redirect: 'follow',
            timeout: 20000
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const html = await res.text();

        // Strategy 1: Extract from OpenGraph video tags (extremely reliable for public shared videos)
        const ogVideo = html.match(/<meta property="og:video" content="([^"]+)"/i) 
                     || html.match(/<meta property="og:video:secure_url" content="([^"]+)"/i)
                     || html.match(/<meta name="twitter:player" content="([^"]+)"/i);

        if (ogVideo?.[1]) {
            const downloadUrl = ogVideo[1].replace(/&amp;/g, '&');
            console.log('[Canva] Found og:video stream:', downloadUrl);
            return {
                type: 'video',
                url: downloadUrl,
                filename: `canva_${Date.now()}.mp4`
            };
        }

        // Strategy 2: Hunt for direct .mp4 links in the page source
        const mp4Matches = html.match(/https?:\/\/[^\s"'`<>]+?\.(?:mp4)[^\s"'`<>]*/gi) || [];
        const cleanMp4Matches = mp4Matches
            .map(v => v.replace(/\\u002F/g, '/').replace(/\\/g, ''))
            .filter(v => v.includes('canva') && !v.includes('tracker') && !v.includes('analytics'));

        if (cleanMp4Matches.length > 0) {
            const downloadUrl = cleanMp4Matches[0];
            console.log('[Canva] Found direct mp4 url:', downloadUrl);
            return {
                type: 'video',
                url: downloadUrl,
                filename: `canva_${Date.now()}.mp4`
            };
        }
    } catch (e) {
        console.warn('[Canva] Resolving failed:', e.message);
    }

    throw new Error('Canva: Gagal mengekstrak video. Tautan mungkin private, memerlukan login, atau bukan berupa video/presentasi publik.');
}
