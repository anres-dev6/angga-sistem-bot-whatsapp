import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getYtdlpPath, getYtdlpBaseArgs } from '../../utils/ytdlpBinary.js';

const execAsync = promisify(exec);

export default async function youtube(url, ctx) {
    // Strategy 1: yt-dlp (paling reliable untuk YouTube)
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

    // Strategy 2: @distube/ytdl-core fallback
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
