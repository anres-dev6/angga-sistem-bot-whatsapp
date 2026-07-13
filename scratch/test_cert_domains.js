import fetch from 'node-fetch';

async function run() {
    const url = 'https://www.tiktok.com/@jokowi/video/7279188448889441541';
    
    // 1. Test waguri.caliphdev.com
    try {
        const waguriUrl = `https://waguri.caliphdev.com/api/download?url=${encodeURIComponent(url)}`;
        console.log('Querying Waguri Caliphdev:', waguriUrl);
        const res = await fetch(waguriUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const text = await res.text();
        console.log('Waguri Response (Truncated):', text.substring(0, 500));
    } catch (e) {
        console.error('Waguri Error:', e.message);
    }

    // 2. Test tiklydown.caliphdev.com
    try {
        const tiklyUrl = `https://tiklydown.caliphdev.com/api/download?url=${encodeURIComponent(url)}`;
        console.log('\nQuerying Tiklydown Caliphdev:', tiklyUrl);
        const res = await fetch(tiklyUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const text = await res.text();
        console.log('Tiklydown Response (Truncated):', text.substring(0, 500));
    } catch (e) {
        console.error('Tiklydown Error:', e.message);
    }

    // 3. Test TikWM with a different video
    try {
        const differentUrl = 'https://vt.tiktok.com/ZS2Rryy5X/'; // A short URL
        const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(differentUrl)}`;
        console.log('\nQuerying TikWM with short URL:', tikwmUrl);
        const res = await fetch(tikwmUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tikwm.com/'
            }
        });
        const text = await res.text();
        console.log('TikWM Short URL Response:', text.substring(0, 500));
    } catch (e) {
        console.error('TikWM Error:', e.message);
    }
}

run().catch(console.error);
