import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ytdl = require('@distube/ytdl-core');

export default async function youtube(url, ctx) {
    try {
        if (!ytdl.validateURL(url)) throw new Error('Invalid YouTube URL');

        const info = await ytdl.getInfo(url);

        // Choose format: Priority to MP4 with audio
        const format = ytdl.chooseFormat(info.formats, { quality: '18' }); // 360p mp4 usually safely available

        if (!format || !format.url) throw new Error('No compatible video format found.');

        return {
            type: 'video',
            url: format.url,
            filename: `yt_${info.videoDetails.videoId}.mp4`,
            title: info.videoDetails.title
        };

    } catch (err) {
        throw new Error(`YouTube Scraper Error: ${err.message}`);
    }
}
