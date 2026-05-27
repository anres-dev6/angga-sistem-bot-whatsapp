import fetch from 'node-fetch';

export default async function twitter(url, ctx) {
    // Strategy 1: Twitter/X Syndication API
    try {
        const tweetId = url.match(/(?:status|statuses)\/(\d+)/)?.[1];
        if (!tweetId) throw new Error('Invalid Twitter/X URL - no tweet ID found');

        console.log('[AutoDL V3 - Twitter] Tweet ID:', tweetId);

        const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=`;
        const res = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (res.ok) {
            const json = await res.json();

            // Video
            if (json.video?.variants) {
                const best = json.video.variants
                    .filter(v => v.content_type === 'video/mp4')
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                if (best) {
                    return { type: 'video', url: best.url, filename: `twitter_${tweetId}.mp4` };
                }
            }

            // Photos
            if (json.photos?.length > 0) {
                return {
                    type: 'image-slide',
                    images: json.photos.map(p => p.url),
                    private: false
                };
            }

            // mediaDetails fallback
            if (json.mediaDetails?.length > 0) {
                const media = json.mediaDetails[0];
                if (media.video_info?.variants) {
                    const best = media.video_info.variants
                        .filter(v => v.content_type === 'video/mp4')
                        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                    if (best) {
                        return { type: 'video', url: best.url, filename: `twitter_${tweetId}.mp4` };
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Twitter] Syndication API failed:', e.message);
    }

    // Strategy 2: twitsave fallback API
    try {
        const tweetId = url.match(/(?:status|statuses)\/(\d+)/)?.[1];
        const apiUrl = `https://twitsave.com/info?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const text = await res.text();

        // Extract download URL from twitsave response
        const match = text.match(/href="(https:\/\/video\.twimg\.com[^"]+)"/);
        if (match?.[1]) {
            return {
                type: 'video',
                url: match[1],
                filename: `twitter_${tweetId || Date.now()}.mp4`
            };
        }
    } catch (e) {
        console.warn('[AutoDL V3 - Twitter] twitsave fallback failed:', e.message);
    }

    throw new Error('Twitter/X: Gagal download. Tweet mungkin private atau media tidak ada.');
}
