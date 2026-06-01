import fetch from 'node-fetch';
import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

function extractAwemeId(url) {
    const m = url.match(/video\/(\d+)/);
    return m ? m[1] : null;
}

export default async function tiktok(url) {
    let finalUrl = url;
    let aweme_id = extractAwemeId(finalUrl);

    // Expand short URL (vt.tiktok.com, vm.tiktok.com)
    if (!aweme_id) {
        try {
            const res = await fetch(url, {
                redirect: 'follow',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
                }
            });
            finalUrl = res.url;
            aweme_id = extractAwemeId(finalUrl);
        } catch (e) {
            console.warn('[TikTok] URL expand failed:', e.message);
        }
    }

    const timestamp = Date.now();
    const vidId = aweme_id || timestamp;

    // Strategy 1: btch-downloader (ttdl)
    try {
        console.log('[TikTok] Trying btch-downloader...');
        const btch = await import('btch-downloader');
        if (btch && typeof btch.ttdl === 'function') {
            const res = await btch.ttdl(finalUrl);
            if (res && typeof res === 'object') {
                if (res.images && res.images.length > 0) {
                    return {
                        type: 'image-slide',
                        images: res.images,
                        private: true,
                        filename: `tiktok_slide_${vidId}`
                    };
                }
                const downloadUrl = res.video || res.nowm || res.url;
                if (downloadUrl && downloadUrl.startsWith('http')) {
                    return {
                        type: 'video',
                        url: downloadUrl,
                        filename: `tiktok_${vidId}.mp4`
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[TikTok] btch-downloader failed:', e.message);
    }

    // Strategy 2: TikWM API (pre-existing strategy)
    try {
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(finalUrl)}&count=12&cursor=0&web=1&hd=1`;
        const res = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tikwm.com/'
            }
        });
        const json = await res.json();

        if (json.code === 0 && json.data) {
            const data = json.data;

            // Slide/Photo mode
            if (data.images && data.images.length > 0) {
                return {
                    type: 'image-slide',
                    images: data.images,
                    private: true,
                    filename: `tiktok_slide_${data.id}`
                };
            }

            // Video mode - prefer HD
            const videoUrl = data.hdplay || data.play;
            if (videoUrl) {
                return {
                    type: 'video',
                    url: videoUrl.startsWith('http') ? videoUrl : `https://www.tikwm.com${videoUrl}`,
                    filename: `tiktok_${data.id || vidId}.mp4`
                };
            }
        }
    } catch (e) {
        console.warn('[TikTok] TikWM failed, trying internal API:', e.message);
    }

    // Strategy 3: TikTok internal API
    if (aweme_id) {
        try {
            const api = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/aweme/detail/?aweme_id=${aweme_id}&device_platform=webapp&aid=1988`;
            const res = await fetch(api, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.tiktok.com/'
                }
            });

            if (res.ok) {
                const text = await res.text();
                if (text.trim().length > 10) {
                    const json = JSON.parse(text);
                    const item = json?.aweme_detail;

                    if (item) {
                        if (item.image_post_info) {
                            return {
                                type: 'image-slide',
                                private: true,
                                images: item.image_post_info.images.map(v => v.display_image.url_list[0])
                            };
                        }

                        const videoUrl = item.video?.play_addr?.url_list?.find(v => !v.includes('watermark')) || item.video?.play_addr?.url_list?.[0];
                        if (videoUrl) {
                            return {
                                type: 'video',
                                url: videoUrl,
                                filename: `tiktok_${aweme_id}.mp4`
                            };
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[TikTok] Internal API failed:', e.message);
        }
    }

    // Strategy 4: yt-dlp fallback
    try {
        console.log('[TikTok] Trying yt-dlp fallback...');
        const result = await downloadMedia(url);
        const filePath = result.filePath;
        const buffer = fs.readFileSync(filePath);
        fs.unlinkSync(filePath);
        return {
            type: 'video',
            buffer,
            url: null,
            filename: `tiktok_${vidId}.mp4`
        };
    } catch (e) {
        console.warn('[TikTok] yt-dlp fallback failed:', e.message);
    }

    throw new Error('TikTok: Semua strategi download gagal. Coba lagi nanti.');
}
