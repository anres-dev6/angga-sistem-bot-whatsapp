import { createRequire } from 'module';
import axios from 'axios';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let abDownloader;
try {
    const {
        igdl,
        ttdl,
        fbdown,
        twitter,
        youtube
    } = require('ab-downloader');
    abDownloader = { igdl, ttdl, fbdown, twitter, youtube };
} catch (e) {
    console.warn('[abDownloader] Failed to load ab-downloader library:', e.message);
    abDownloader = {};
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOAD_DIR = path.join(__dirname, '..', 'download');

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function downloadFile(url, prefix) {
    if (!url) throw new Error("URL download kosong");

    const timestamp = Date.now();
    let ext = 'mp4';
    if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('f=jpg')) ext = 'jpg';

    const filename = `${prefix}_${timestamp}.${ext}`;
    const filePath = path.join(DOWNLOAD_DIR, filename);

    const writer = fs.createWriteStream(filePath);

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            resolve({ filePath, size: sizeMB, filename });
        });
        writer.on('error', reject);
    });
}

// ===== FALLBACK API FUNCTIONS =====

async function instagramFallback(url) {
    // Try indown.io API
    const res = await fetch('https://indown.io/api/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({ link: url, locale: 'id', index: 0 })
    });
    if (!res.ok) throw new Error(`indown.io: ${res.status}`);
    const json = await res.json();
    if (json.url) return { single: json.url };
    if (json.urls?.length > 0) return { slide: json.urls };
    throw new Error('No media found on indown.io');
}

async function tiktokFallback(url) {
    // Try TikWM API
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
        if (data.images?.length > 0) return { slide: data.images };
        const videoUrl = data.hdplay || data.play;
        if (videoUrl) return { single: videoUrl.startsWith('http') ? videoUrl : `https://www.tikwm.com${videoUrl}` };
    }
    throw new Error('TikWM: no data');
}

async function twitterFallback(url) {
    const tweetId = url.match(/(?:status|statuses)\/(\d+)/)?.[1];
    if (!tweetId) throw new Error('No tweet ID in URL');
    const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`;
    const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Twitter syndication: ${res.status}`);
    const json = await res.json();
    if (json.video?.variants) {
        const best = json.video.variants
            .filter(v => v.content_type === 'video/mp4')
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        if (best) return { single: best.url };
    }
    if (json.photos?.length > 0) return { slide: json.photos.map(p => p.url) };
    throw new Error('No media in tweet');
}

// ===== MAIN EXPORT =====

export async function downloadMedia(url) {
    const platform = detectPlatform(url);
    if (!platform) throw new Error("Platform tidak didukung oleh AutoDL V2");

    console.log(`[AutoDL V2] Processing ${platform}: ${url}`);

    let metadata = {
        title: 'Media', caption: '-', author: '-',
        likes: '-', comments: '-', shares: '-', country: '-'
    };

    let resultUrl = null;

    // ─────────── INSTAGRAM ───────────
    if (platform === 'instagram') {
        // Try ab-downloader first
        if (abDownloader.igdl) {
            try {
                const res = await abDownloader.igdl(url);
                if (res.result?.length > 1) {
                    resultUrl = res.result.map(item => item.url || item.download_link);
                    metadata.isSlide = true;
                } else if (res.result?.length === 1) {
                    resultUrl = res.result[0].url || res.result[0].download_link;
                } else if (res.url) {
                    resultUrl = res.url;
                }
                if (res.caption) metadata.caption = res.caption;
                if (res.username || res.author) metadata.author = res.username || res.author;
            } catch (e) {
                console.warn('[AutoDL V2 IG] ab-downloader failed:', e.message);
            }
        }
        // Fallback
        if (!resultUrl) {
            try {
                const fallback = await instagramFallback(url);
                if (fallback.slide) { resultUrl = fallback.slide; metadata.isSlide = true; }
                else resultUrl = fallback.single;
            } catch (e) {
                throw new Error(`Instagram download gagal: ${e.message}`);
            }
        }
    }

    // ─────────── TIKTOK ───────────
    else if (platform === 'tiktok') {
        // Try TikWM first (more reliable than ab-downloader for TikTok)
        try {
            const fallback = await tiktokFallback(url);
            if (fallback.slide) { resultUrl = fallback.slide; metadata.isSlide = true; }
            else resultUrl = fallback.single;
        } catch (e) {
            console.warn('[AutoDL V2 TikTok] TikWM failed, trying ab-downloader:', e.message);
            if (abDownloader.ttdl) {
                try {
                    const res = await abDownloader.ttdl(url);
                    if (res.images?.length > 0) { resultUrl = res.images; metadata.isSlide = true; }
                    else resultUrl = res.video || res.nowm || res.url;
                    if (res.desc) metadata.caption = res.desc;
                    if (res.author || res.nickname) metadata.author = res.nickname || res.author;
                } catch (e2) {
                    throw new Error(`TikTok download gagal: ${e2.message}`);
                }
            } else {
                throw new Error(`TikTok download gagal: ${e.message}`);
            }
        }
    }

    // ─────────── TWITTER ───────────
    else if (platform === 'twitter') {
        try {
            const fallback = await twitterFallback(url);
            if (fallback.slide) { resultUrl = fallback.slide; metadata.isSlide = true; }
            else resultUrl = fallback.single;
        } catch (e) {
            console.warn('[AutoDL V2 Twitter] Syndication failed, trying ab-downloader:', e.message);
            if (abDownloader.twitter) {
                try {
                    const res = await abDownloader.twitter(url);
                    resultUrl = res.HD || res.SD || res.video_hd || res.video_sd || res.url;
                    if (res.desc || res.title) metadata.caption = res.desc || res.title;
                } catch (e2) {
                    throw new Error(`Twitter download gagal: ${e2.message}`);
                }
            } else {
                throw new Error(`Twitter download gagal: ${e.message}`);
            }
        }
    }

    // ─────────── FACEBOOK ───────────
    else if (platform === 'facebook') {
        if (abDownloader.fbdown) {
            try {
                const res = await abDownloader.fbdown(url);
                resultUrl = res.HD || res.SD || res.Normal || res.url;
                if (res.title) metadata.caption = res.title;
            } catch (e) {
                console.warn('[AutoDL V2 FB] ab-downloader failed:', e.message);
            }
        }
        if (!resultUrl) {
            // SnapSave fallback
            try {
                const res = await fetch('https://snapsave.app/action.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0',
                        'Origin': 'https://snapsave.app',
                        'Referer': 'https://snapsave.app/'
                    },
                    body: `url=${encodeURIComponent(url)}`
                });
                const text = await res.text();
                const hdMatch = text.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>HD/i);
                const sdMatch = text.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>SD/i);
                resultUrl = (hdMatch?.[1] || sdMatch?.[1])?.replace(/&amp;/g, '&');
            } catch (e) {
                throw new Error(`Facebook download gagal: ${e.message}`);
            }
        }
        if (!resultUrl) throw new Error('Facebook: Tidak ada link yang berhasil ditemukan.');
    }

    // ─────────── YOUTUBE ───────────
    else if (platform === 'youtube') {
        if (abDownloader.youtube) {
            try {
                const res = await abDownloader.youtube(url);
                resultUrl = res.video || res.mp4 || res.url;
                if (res.title) { metadata.title = res.title; metadata.caption = res.title; }
            } catch (e) {
                throw new Error(`YouTube download gagal via AutoDL V2: ${e.message}\n💡 Coba .yt atau .ytv untuk YouTube.`);
            }
        } else {
            throw new Error('YouTube: Gunakan command .yt atau .ytv untuk download YouTube.');
        }
    }

    if (!resultUrl && !metadata.isSlide) throw new Error(`Tidak ada media yang berhasil diambil untuk ${platform}`);

    // ─── Download file ───
    if (!metadata.isSlide) {
        const fileInfo = await downloadFile(resultUrl, platform);
        return { platform, filePath: fileInfo.filePath, size: fileInfo.size, title: metadata.title, metadata };
    } else {
        const downloadedFiles = [];
        let totalSize = 0;
        for (const mediaUrl of resultUrl) {
            try {
                const fileInfo = await downloadFile(mediaUrl, platform);
                downloadedFiles.push(fileInfo.filePath);
                totalSize += parseFloat(fileInfo.size);
            } catch (e) {
                console.error(`[AutoDL V2] Failed to download slide: ${mediaUrl}`, e.message);
            }
        }
        if (downloadedFiles.length === 0) throw new Error("Gagal download semua slide.");
        return { platform, isSlide: true, files: downloadedFiles, size: totalSize.toFixed(2), title: metadata.title, metadata };
    }
}

export function detectPlatform(url) {
    if (/instagram\.com/.test(url)) return "instagram";
    if (/facebook\.com|fb\.watch|fb\.com/.test(url)) return "facebook";
    if (/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/.test(url)) return "tiktok";
    if (/twitter\.com|x\.com/.test(url)) return "twitter";
    if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
    return null;
}

export default { downloadMedia, detectPlatform };
