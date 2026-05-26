import fetch from 'node-fetch';

function headers() {
    return {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
        'referer': 'https://www.tiktok.com/'
    };
}

function extractAwemeId(url) {
    const m = url.match(/video\/(\d+)/);
    return m ? m[1] : null;
}

export default async function tiktok(url) {
    let finalUrl = url;
    let aweme_id = extractAwemeId(finalUrl);

    // 1️⃣ Expand Short URL (vt.tiktok.com, vm.tiktok.com)
    // If we don't have an ID, we MUST follow redirects to get the canonical URL
    if (!aweme_id) {
        try {
            const res = await fetch(url, {
                redirect: 'follow',
                headers: headers()
            });
            finalUrl = res.url;
            aweme_id = extractAwemeId(finalUrl);
        } catch (e) {
            // Ignore fetch error here, will fail at check below
        }
    }

    if (!aweme_id) throw new Error('Invalid TikTok URL (ID not found)');

    // 2️⃣ TikTok Internal API (The "Anti-Mati" Solution)
    try {
        const api =
            `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/aweme/detail/` +
            `?aweme_id=${aweme_id}&device_platform=webapp&aid=1988`;

        const res = await fetch(api, { headers: headers() });

        if (res.ok) {
            const text = await res.text();
            // Use fallback if response is empty or obviously too short to be valid JSON
            if (text.trim().length > 10) {
                const json = JSON.parse(text);
                const item = json?.aweme_detail;

                if (item) {
                    // 🖼️ SLIDE / PHOTO MODE
                    if (item.image_post_info) {
                        return {
                            type: 'image-slide',
                            private: true,
                            images: item.image_post_info.images.map(v => v.display_image.url_list[0])
                        };
                    }

                    // 🎥 VIDEO MODE
                    return {
                        type: 'video',
                        url: item.video.play_addr.url_list.find(v => !v.includes('watermark')) || item.video.play_addr.url_list[0],
                        filename: `tiktok_${aweme_id}.mp4`
                    };
                }
            } else {
                console.warn('[TikTok] Internal API returned empty/tooshort response.');
            }
        } else {
            console.warn(`[TikTok] Internal API failed: ${res.status}`);
        }
    } catch (e) {
        console.warn('[TikTok] Internal API error (skipping to fallback):', e.message);
    }

    // 3️⃣ Fallback Strategy: TikWM API (Public)
    try {
        // Encode the ORIGINAL finalUrl, not the aweme_id constructed one
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(finalUrl)}&count=12&cursor=0&web=1&hd=1`;
        const res = await fetch(apiUrl);
        const json = await res.json();

        if (json.code === 0 && json.data) {
            const data = json.data;

            if (data.images && data.images.length > 0) {
                return {
                    type: 'image-slide',
                    images: data.images,
                    private: true,
                    filename: `tiktok_slide_${data.id}`
                };
            }

            return {
                type: 'video',
                url: data.play.startsWith('http') ? data.play : `https://www.tikwm.com${data.play}`,
                filename: `tiktok_${data.id}.mp4`
            };
        }
    } catch (e) {
        throw new Error(`All TikTok strategies failed. Internal & TikWM Error: ${e.message}`);
    }

    throw new Error('TikTok Resolver Failed: Internal API blocked and TikWM returned no data.');
}
