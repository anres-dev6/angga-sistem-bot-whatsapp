import fetch from 'node-fetch';
import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

export default async function instagram(url, ctx) {
    console.log('[AutoDL V3 - Instagram] Resolving:', url);

    // Strategy 1: btch-downloader (igdl)
    try {
        console.log('[AutoDL V3 - Instagram] Trying btch-downloader...');
        const btch = await import('btch-downloader');
        if (btch && typeof btch.igdl === 'function') {
            const res = await btch.igdl(url);
            let mediaUrls = [];

            if (Array.isArray(res)) {
                mediaUrls = res.map(v => v.url || v.download_link || v).filter(Boolean);
            } else if (res && typeof res === 'object') {
                if (res.result && Array.isArray(res.result)) {
                    mediaUrls = res.result.map(v => v.url || v.download_link || v).filter(Boolean);
                } else if (res.url) {
                    mediaUrls = [res.url];
                } else if (res.result) {
                    mediaUrls = [res.result];
                }
            } else if (typeof res === 'string') {
                mediaUrls = [res];
            }

            if (mediaUrls.length > 1) {
                return {
                    type: 'image-slide',
                    images: mediaUrls,
                    private: false
                };
            } else if (mediaUrls.length === 1) {
                const downloadUrl = mediaUrls[0];
                return {
                    type: 'video',
                    url: downloadUrl,
                    filename: `ig_${Date.now()}.${downloadUrl.includes('.jpg') || downloadUrl.includes('.png') ? 'jpg' : 'mp4'}`
                };
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] btch-downloader failed:', e.message);
    }

    // Strategy 2: Tiklydown / Caliph API
    try {
        console.log('[AutoDL V3 - Instagram] Trying Tiklydown API...');
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        const res = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
            timeout: 15000
        });
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

        if (res.ok) {
            const json = await res.json();
            if (json && json.result) {
                const result = json.result;
                let mediaUrls = [];

                if (Array.isArray(result)) {
                    mediaUrls = result.map(v => v.url || v.download_link || v).filter(Boolean);
                } else if (result.video) {
                    mediaUrls = [result.video];
                } else if (result.url) {
                    mediaUrls = [result.url];
                }

                if (mediaUrls.length > 1) {
                    return {
                        type: 'image-slide',
                        images: mediaUrls,
                        private: false,
                        metadata: {
                            caption: result.caption || result.title || '',
                            author: result.owner?.username || result.author?.username || '',
                            views: result.view_count || 0,
                            likes: result.like_count || 0,
                            shares: result.share_count || 0
                        }
                    };
                } else if (mediaUrls.length === 1) {
                    const downloadUrl = mediaUrls[0];
                    return {
                        type: 'video',
                        url: downloadUrl,
                        filename: `ig_${Date.now()}.${downloadUrl.includes('.jpg') || downloadUrl.includes('.png') ? 'jpg' : 'mp4'}`,
                        metadata: {
                            caption: result.caption || result.title || '',
                            author: result.owner?.username || result.author?.username || '',
                            views: result.view_count || 0,
                            likes: result.like_count || 0,
                            shares: result.share_count || 0
                        }
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] Tiklydown API failed:', e.message);
    }

    // Strategy 3: Owner's Dashboard API fallback
    try {
        console.log('[AutoDL V3 - Instagram] Trying Owner API...');
        const res = await fetch(`https://api-g4nggaa.biz.id/api/download/instagram?url=${encodeURIComponent(url)}`, {
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
                        filename: `ig_${Date.now()}.mp4`
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] Owner API failed:', e.message);
    }

    // Strategy 4: Indown.io scraping fallback (pre-existing strategy)
    try {
        console.log('[AutoDL V3 - Instagram] Trying indown.io scraping fallback...');
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
                return {
                    type: 'video',
                    url: json.url,
                    filename: `ig_${Date.now()}.mp4`
                };
            }
            if (json.urls && Array.isArray(json.urls) && json.urls.length > 0) {
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

    // Strategy 5: yt-dlp via Lib/downloader.js (pre-existing strategy)
    try {
        console.log('[AutoDL V3 - Instagram] Trying yt-dlp fallback...');
        const result = await downloadMedia(url);
        const buffer = fs.readFileSync(result.filePath);
        const isVideo = result.filePath.endsWith('.mp4') || result.filePath.endsWith('.mkv') || result.filePath.endsWith('.webm');
        fs.unlinkSync(result.filePath);

        if (isVideo) {
            return { type: 'video', buffer, url: null, filename: `ig_${Date.now()}.mp4` };
        } else {
            return { type: 'image-slide', images: [buffer], private: false };
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] yt-dlp failed:', e.message);
    }

    throw new Error('Instagram: Gagal download media via API. Post mungkin private atau tidak didukung.');
}
