import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getYtdlpPath, getYtdlpBaseArgs } from '../../utils/ytdlpBinary.js';
import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

const execAsync = promisify(exec);

export default async function youtube(url, ctx) {
    // Strategy 1: ab-downloader (V3 menggunakan abDownloader)
    try {
        console.log('[AutoDL V3 - YouTube] Downloading using ab-downloader...');
        const { downloadMedia: downloadMediaAb } = await import('../../utils/abDownloader.js');
        const result = await downloadMediaAb(url);
        if (result && result.filePath) {
            const buffer = fs.readFileSync(result.filePath);
            try {
                fs.unlinkSync(result.filePath);
            } catch (err) {
                console.error('[AutoDL V3 - YouTube] Cleanup error:', err);
            }
            return {
                type: 'video',
                buffer,
                url: null,
                filename: `yt_${Date.now()}.mp4`,
                title: result.title || 'YouTube Video'
            };
        }
    } catch (e) {
        console.warn('[AutoDL V3 - YouTube] ab-downloader failed:', e.message);
    }

    // Strategy 2: Downloader (V3 fallback menggunakan Lib/downloader.js - yt-dlp)
    try {
        console.log('[AutoDL V3 - YouTube] Downloading using Lib/downloader.js (yt-dlp)...');
        const result = await downloadMedia(url);
        if (result && result.filePath) {
            const buffer = fs.readFileSync(result.filePath);
            try {
                fs.unlinkSync(result.filePath);
            } catch (err) {
                console.error('[AutoDL V3 - YouTube] Cleanup error:', err);
            }
            return {
                type: 'video',
                buffer,
                url: null,
                filename: `yt_${Date.now()}.mp4`,
                title: result.title || 'YouTube Video'
            };
        }
    } catch (e) {
        console.warn('[AutoDL V3 - YouTube] Lib/downloader failed:', e.message);
    }

    // Strategy 2: yt-dlp (paling reliable untuk YouTube)
    try {
        const ytdlpPath = getYtdlpPath().replace(/\\/g, '/');
        const cmd = `"${ytdlpPath}" ${getYtdlpBaseArgs()} --dump-json --quiet "${url}"`;
        const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
        const info = JSON.parse(stdout);

        // Pilih format terbaik yang kompatibel tanpa perlu merge (sudah ada audio+video)
        const formats = (info.formats || []).filter(f =>
            f.ext === 'mp4' && f.acodec !== 'none' && f.vcodec !== 'none' && f.url
        );

        // Urutkan: priority 360p → 480p → 720p (aman untuk WA)
        const preferred = [360, 480, 240, 720];
        let bestFormat = null;
        for (const h of preferred) {
            bestFormat = formats.find(f => f.height === h);
            if (bestFormat) break;
        }
        if (!bestFormat) bestFormat = formats[0];

        if (bestFormat?.url) {
            return {
                type: 'video',
                url: bestFormat.url,
                filename: `yt_${info.id}.mp4`,
                title: info.title
            };
        }
    } catch (e) {
        console.warn('[AutoDL V3 - YouTube] yt-dlp dump-json failed:', e.message);
    }

    // Strategy 3: @distube/ytdl-core fallback
    try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const ytdl = require('@distube/ytdl-core');

        if (!ytdl.validateURL(url)) throw new Error('Invalid YouTube URL');
        const info = await ytdl.getInfo(url);

        // Cari format mp4 yang ada audio dan video sekaligus
        const formats = ytdl.filterFormats(info.formats, 'audioandvideo');
        const mp4Formats = formats.filter(f => f.container === 'mp4').sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        const format = mp4Formats[0] || ytdl.chooseFormat(info.formats, { quality: '18' });

        if (format?.url) {
            return {
                type: 'video',
                url: format.url,
                filename: `yt_${info.videoDetails.videoId}.mp4`,
                title: info.videoDetails.title
            };
        }
    } catch (e) {
        console.warn('[AutoDL V3 - YouTube] ytdl-core failed:', e.message);
    }

    throw new Error('YouTube: Gagal mendapatkan link video. Coba command .yt atau .ytv untuk kualitas manual.');
}
