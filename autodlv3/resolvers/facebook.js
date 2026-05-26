import fetch from '../utils/fetch.js';
import * as cheerio from 'cheerio';

export default async function facebook(url, ctx) {
    try {
        // FB often needs valid User-Agent, handled by custom fetch
        const res = await fetch(url);
        const html = await res.text();
        const $ = cheerio.load(html);

        // FB Video scraping
        // Look for HD/SD sources in scripts or meta
        // Basic meta support first

        const videoUrl = $('meta[property="og:video"]').attr('content') ||
            $('meta[property="og:video:secure_url"]').attr('content');

        if (videoUrl) {
            return {
                type: 'video',
                url: videoUrl,
                filename: `fb_${Date.now()}.mp4`
            };
        }

        // Regex fallback for FB source
        const sdSrc = html.match(/"browser_native_sd_url":"(.*?)"/)?.[1];
        const hdSrc = html.match(/"browser_native_hd_url":"(.*?)"/)?.[1];

        const validUrl = (hdSrc || sdSrc || '').replace(/\\/g, ''); // Unescape slashes if necessary

        if (validUrl) {
            return {
                type: 'video',
                url: validUrl,
                filename: `fb_${Date.now()}.mp4`
            };
        }

        throw new Error('No media found via scraper.');

    } catch (err) {
        throw new Error(`Facebook Scraper Error: ${err.message}`);
    }
}
