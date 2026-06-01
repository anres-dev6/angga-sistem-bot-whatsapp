import fetch from 'node-fetch';

export default async function capcut(url) {
    console.log('[AutoDL V3 - CapCut] Resolving:', url);

    // Strategy 1: btch-downloader (capcut)
    try {
        console.log('[CapCut] Trying btch-downloader...');
        const btch = await import('btch-downloader');
        if (btch && typeof btch.capcut === 'function') {
            const res = await btch.capcut(url);
            if (res && typeof res === 'object') {
                const downloadUrl = res.video || res.url || res.download_link;
                if (downloadUrl && downloadUrl.startsWith('http')) {
                    return {
                        type: 'video',
                        url: downloadUrl,
                        filename: `capcut_${Date.now()}.mp4`
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[CapCut] btch-downloader failed:', e.message);
    }

    // Strategy 2: Owner's Dashboard API fallback
    try {
        console.log('[CapCut] Trying Owner API...');
        const res = await fetch(`https://api-g4nggaa.biz.id/api/download/capcut?url=${encodeURIComponent(url)}`, {
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
                        filename: `capcut_${Date.now()}.mp4`
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[CapCut] Owner API failed:', e.message);
    }

    // Strategy 3: Dynamic OpenGraph Scraper
    try {
        console.log('[CapCut] Trying Dynamic OpenGraph Scraper...');
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html'
            },
            redirect: 'follow',
            timeout: 15000
        });

        if (res.ok) {
            const html = await res.text();
            // Hunt for og:video:url or twitter:player or videoUrl
            const match = html.match(/<meta property="og:video:url" content="([^"]+)"/i) 
                       || html.match(/<meta property="og:video" content="([^"]+)"/i)
                       || html.match(/<meta name="twitter:player" content="([^"]+)"/i)
                       || html.match(/"videoUrl":"([^"]+)"/i);

            if (match?.[1]) {
                const downloadUrl = match[1].replace(/&amp;/g, '&');
                return {
                    type: 'video',
                    url: downloadUrl,
                    filename: `capcut_${Date.now()}.mp4`
                };
            }
        }
    } catch (e) {
        console.warn('[CapCut] Scraper fallback failed:', e.message);
    }

    throw new Error('CapCut: Gagal mendownload template. Tautan mungkin private atau tidak valid.');
}
