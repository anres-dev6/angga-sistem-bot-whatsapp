import fetch from '../utils/fetch.js';
import * as cheerio from 'cheerio';

export default async function twitter(url, ctx) {
    try {
        // Twitter/X scraping is notoriously hard without API or specialized tools (like syndication API).
        // Since V2 uses a robust method via ab-downloader, and V1 uses yt-dlp.
        // For V3 "Pure Scraper", we can try the syndication URL trick or similar.

        // Syndication API trick (often used by yt-dlp internals)
        const tweetId = url.match(/(?:status|statuses)\/(\d+)/)?.[1];
        if (!tweetId) throw new Error('Invalid Twitter URL');

        const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`;

        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`Twitter API Error: ${res.status}`);

        const json = await res.json();

        // Extract video
        const video = json.video;
        if (video && video.variants) {
            // Get best quality
            const bestVariant = video.variants
                .filter(v => v.content_type === 'video/mp4')
                .sort((a, b) => b.bitrate - a.bitrate)[0];

            if (bestVariant) {
                return {
                    type: 'video',
                    url: bestVariant.url,
                    filename: `twitter_${tweetId}.mp4`
                };
            }
        }

        // Extract Photos
        if (json.photos) {
            const images = json.photos.map(p => p.url);
            return {
                type: 'image-slide',
                images: images,
                private: false
            };
        }

        throw new Error('No media found in tweet.');

    } catch (err) {
        throw new Error(`Twitter Scraper Error: ${err.message}`);
    }
}
