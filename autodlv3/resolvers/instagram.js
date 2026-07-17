import fetch from 'node-fetch';
import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

/**
 * Deteksi apakah suatu URL adalah video berdasarkan ekstensinya
 */
function isVideoUrl(url) {
    if (typeof url !== 'string') return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.mp4') || clean.endsWith('.m3u8') || clean.endsWith('.webm') || clean.endsWith('.mov');
}

/**
 * Pisahkan array media dari btch-downloader/API ke dalam foto dan video
 * Setiap item bisa berupa: string URL, { url, type }, atau { download_link, type }
 */
function classifyMedia(items) {
    const images = [];
    const videos = [];

    for (const item of items) {
        let url = null;
        let typeHint = null;

        if (typeof item === 'string') {
            url = item;
        } else if (item && typeof item === 'object') {
            url = item.url || item.download_link || item.src || null;
            typeHint = item.type || item.media_type || null;
        }

        if (!url || !url.startsWith('http')) continue;

        // Cek tipe berdasarkan field type ATAU ekstensi URL
        const isVid = (typeHint && (typeHint === 'video' || typeHint.includes('video'))) || isVideoUrl(url);

        if (isVid) {
            videos.push(url);
        } else {
            images.push(url);
        }
    }

    return { images, videos };
}

export default async function instagram(url, ctx) {
    console.log('[AutoDL V3 - Instagram] Resolving:', url);

    // Strategy 1: btch-downloader (igdl)
    try {
        console.log('[AutoDL V3 - Instagram] Trying btch-downloader...');
        const btch = await import('btch-downloader');
        if (btch && typeof btch.igdl === 'function') {
            const res = await btch.igdl(url);
            let rawItems = [];

            if (Array.isArray(res)) {
                rawItems = res;
            } else if (res && typeof res === 'object') {
                if (res.result && Array.isArray(res.result)) {
                    rawItems = res.result;
                } else if (res.url) {
                    rawItems = [res];
                } else if (typeof res.result === 'string') {
                    rawItems = [{ url: res.result }];
                }
            } else if (typeof res === 'string') {
                rawItems = [{ url: res }];
            }

            const { images, videos } = classifyMedia(rawItems);
            console.log(`[AutoDL V3 - Instagram] btch-downloader: ${images.length} foto, ${videos.length} video`);

            // Carousel foto
            if (images.length > 1) {
                return { type: 'image-slide', images, private: false };
            }
            // Single foto
            if (images.length === 1 && videos.length === 0) {
                return { type: 'video', url: images[0], filename: `ig_${Date.now()}.jpg` };
            }
            // Single video
            if (videos.length === 1 && images.length === 0) {
                return { type: 'video', url: videos[0], filename: `ig_${Date.now()}.mp4` };
            }
            // Carousel campur (foto + video) → kirim foto dulu, video diabaikan
            if (images.length > 0) {
                return { type: 'image-slide', images, private: false };
            }
            // Hanya video (multiple video carousel)
            if (videos.length > 0) {
                return { type: 'video', url: videos[0], filename: `ig_${Date.now()}.mp4` };
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
                const meta = {
                    caption: result.caption || result.title || '',
                    author: result.owner?.username || result.author?.username || '',
                    views: result.view_count || 0,
                    likes: result.like_count || 0,
                    shares: result.share_count || 0
                };

                let rawItems = [];
                if (Array.isArray(result)) {
                    rawItems = result;
                } else if (Array.isArray(result.media)) {
                    rawItems = result.media;
                } else if (result.video) {
                    rawItems = [{ url: result.video, type: 'video' }];
                } else if (result.url) {
                    rawItems = [{ url: result.url }];
                }

                if (rawItems.length > 0) {
                    const { images, videos } = classifyMedia(rawItems);
                    console.log(`[AutoDL V3 - Instagram] Tiklydown: ${images.length} foto, ${videos.length} video`);

                    if (images.length > 1) {
                        return { type: 'image-slide', images, private: false, metadata: meta };
                    }
                    if (images.length === 1 && videos.length === 0) {
                        return { type: 'video', url: images[0], filename: `ig_${Date.now()}.jpg`, metadata: meta };
                    }
                    if (videos.length >= 1) {
                        return { type: 'video', url: videos[0], filename: `ig_${Date.now()}.mp4`, metadata: meta };
                    }
                    if (images.length > 0) {
                        return { type: 'image-slide', images, private: false, metadata: meta };
                    }
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
                // Bisa berupa array (carousel) atau single object
                if (Array.isArray(json.result)) {
                    const { images, videos } = classifyMedia(json.result);
                    if (images.length > 1) return { type: 'image-slide', images, private: false };
                    if (images.length === 1) return { type: 'video', url: images[0], filename: `ig_${Date.now()}.jpg` };
                    if (videos.length >= 1) return { type: 'video', url: videos[0], filename: `ig_${Date.now()}.mp4` };
                }
                const downloadUrl = json.result.url || json.result.download_link || json.result;
                if (downloadUrl && typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
                    return {
                        type: 'video',
                        url: downloadUrl,
                        filename: `ig_${Date.now()}.${isVideoUrl(downloadUrl) ? 'mp4' : 'jpg'}`
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] Owner API failed:', e.message);
    }

    // Strategy 4: Indown.io scraping fallback
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
                    filename: `ig_${Date.now()}.${isVideoUrl(json.url) ? 'mp4' : 'jpg'}`
                };
            }
            if (json.urls && Array.isArray(json.urls) && json.urls.length > 0) {
                const { images, videos } = classifyMedia(json.urls.map(u => ({ url: u })));
                if (images.length > 1) return { type: 'image-slide', images, private: false };
                if (images.length >= 1) return { type: 'video', url: images[0], filename: `ig_${Date.now()}.jpg` };
                if (videos.length >= 1) return { type: 'video', url: videos[0], filename: `ig_${Date.now()}.mp4` };
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] indown.io failed:', e.message);
    }

    // Strategy 5: yt-dlp via Lib/downloader.js (last resort)
    try {
        console.log('[AutoDL V3 - Instagram] Trying yt-dlp fallback...');
        const result = await downloadMedia(url);
        const buffer = fs.readFileSync(result.filePath);
        const isVid = result.filePath.endsWith('.mp4') || result.filePath.endsWith('.mkv') || result.filePath.endsWith('.webm');
        fs.unlinkSync(result.filePath);

        if (isVid) {
            return { type: 'video', buffer, url: null, filename: `ig_${Date.now()}.mp4` };
        } else {
            return { type: 'image-slide', images: [buffer], private: false };
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Instagram] yt-dlp failed:', e.message);
    }

    throw new Error('Instagram: Gagal download media via API. Post mungkin private atau tidak didukung.');
}
