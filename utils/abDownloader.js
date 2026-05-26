import { createRequire } from 'module';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const {
    igdl,
    ttdl,
    fbdown,
    twitter,
    youtube
} = require('ab-downloader');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOAD_DIR = path.join(__dirname, '..', 'download');

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function downloadFile(url, prefix) {
    if (!url) throw new Error("URL download kosong");

    // Attempt to handle Google Drive/other direct links that might not be streaming friendly directly?
    // But mainly for social media video/image URLs.

    const timestamp = Date.now();
    // Guess extension
    let ext = 'mp4';
    if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('f=jpg')) ext = 'jpg';

    const filename = `${prefix}_${timestamp}.${ext}`;
    const filePath = path.join(DOWNLOAD_DIR, filename);

    const writer = fs.createWriteStream(filePath);

    // Some URLs might block requests without User-Agent
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            resolve({
                filePath,
                size: sizeMB,
                filename
            });
        });
        writer.on('error', reject);
    });
}

export async function downloadMedia(url) {
    const platform = detectPlatform(url);
    if (!platform) throw new Error("Platform tidak didukung oleh AutoDL V2");

    console.log(`[ab-downloader] Processing ${platform}: ${url}`);

    let resultUrl;
    let title = 'Media'; // This variable will be replaced by metadata.title

    try {
        let metadata = {
            title: 'Media',
            caption: '-',
            author: '-',
            likes: '-',
            comments: '-',
            shares: '-', // Added for TikTok
            country: '-'
        };

        if (platform === 'instagram') {
            const res = await igdl(url);
            console.log(`[ab-downloader] IG Response:`, JSON.stringify(res, null, 2)); // Debug log

            // Handle varied responses
            if (res.result && Array.isArray(res.result) && res.result.length > 1) {
                metadata.isSlide = true;
                resultUrl = res.result.map(item => item.url || item.download_link || item._url);
            } else if (res.result && Array.isArray(res.result) && res.result.length > 0) {
                resultUrl = res.result[0].url || res.result[0].download_link || res.result[0]._url;
            } else if (res.url) {
                resultUrl = res.url;
            } else if (Array.isArray(res) && res.length > 0) {
                resultUrl = res[0].url;
            } else {
                throw new Error('Gagal mendapatkan link download Instagram (Struktur response tidak dikenali)');
            }

            // IG Metadata Attempt (Structure varies)
            if (res.caption) metadata.caption = res.caption;
            if (res.likes) metadata.likes = res.likes;
            if (res.comments) metadata.comments = res.comments;
            if (res.username || res.author) metadata.author = res.username || res.author;

        } else if (platform === 'twitter') {
            const res = await twitter(url);
            console.log(`[ab-downloader] Twitter Response:`, JSON.stringify(res, null, 2));

            if (res.HD) resultUrl = res.HD;
            else if (res.SD) resultUrl = res.SD;
            else if (res.video_hd) resultUrl = res.video_hd;
            else if (res.video_sd) resultUrl = res.video_sd;
            else if (res.url) resultUrl = res.url;
            else {
                throw new Error('Gagal mendapatkan link download Twitter');
            }

            if (res.desc) metadata.caption = res.desc;
            else if (res.title) metadata.caption = res.title; // sometimes used as caption

            // Twitter specific metadata often not in this scraper response, but we check
            if (res.author) metadata.author = res.author;

        } else if (platform === 'tiktok') {
            const res = await ttdl(url);
            console.log(`[ab-downloader] TikTok Response:`, JSON.stringify(res, null, 2));

            // Check for Slideshow (Images)
            if (res.images && Array.isArray(res.images) && res.images.length > 0) {
                metadata.isSlide = true;
                resultUrl = res.images; // Array of URLs
            } else {
                resultUrl = res.video || res.nowm || res.url;
            }

            if (res.desc) metadata.caption = res.desc;
            if (res.author) metadata.author = res.author;
            if (res.nickname) metadata.author = res.nickname;

            // Stats
            if (res.likes) metadata.likes = res.likes;
            if (res.share) metadata.shares = res.share;
            if (res.comment) metadata.comments = res.comment;
            if (res.region) metadata.country = res.region;

        } else if (platform === 'facebook') {
            const res = await fbdown(url);
            console.log(`[ab-downloader] FB Response:`, JSON.stringify(res, null, 2));

            resultUrl = res.HD || res.SD || res.Normal || res.url;

            if (res.title) metadata.caption = res.title;

        } else if (platform === 'youtube') {
            const res = await youtube(url);
            console.log(`[ab-downloader] YT Response:`, JSON.stringify(res, null, 2));

            resultUrl = res.video || res.mp4 || res.url;

            if (res.title) metadata.title = res.title;
            metadata.caption = res.title; // use title as caption
        }

        if (!resultUrl && !metadata.isSlide) throw new Error(`Respon kosong dari ab-downloader untuk ${platform}`);

        // Handle Single File Download
        if (!metadata.isSlide) {
            const fileInfo = await downloadFile(resultUrl, platform);
            return {
                platform,
                filePath: fileInfo.filePath,
                size: fileInfo.size,
                title: metadata.title,
                metadata
            };
        } else {
            // Handle Slides/Multiple Files
            const downloadedFiles = [];
            let totalSize = 0;

            for (const mediaUrl of resultUrl) { // resultUrl is array here
                try {
                    const fileInfo = await downloadFile(mediaUrl, platform);
                    downloadedFiles.push(fileInfo.filePath);
                    totalSize += parseFloat(fileInfo.size);
                } catch (e) {
                    console.error(`Failed to download slide: ${mediaUrl}`, e);
                }
            }

            if (downloadedFiles.length === 0) throw new Error("Gagal download semua slide.");

            return {
                platform,
                isSlide: true,
                files: downloadedFiles,
                size: totalSize.toFixed(2),
                title: metadata.title,
                metadata
            };
        }

    } catch (err) {
        console.error(`[ab-downloader] Error for ${url}:`, err);
        throw new Error(`Gagal download via ab-downloader: ${err.message}`);
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

export default {
    downloadMedia,
    detectPlatform
};
