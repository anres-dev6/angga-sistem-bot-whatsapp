import fetch from 'node-fetch';

async function run() {
    const shortUrl = 'https://vt.tiktok.com/ZS2Rryy5X/';
    
    // 1. Resolve short URL
    console.log('Resolving short URL...');
    const res = await fetch(shortUrl, {
        redirect: 'follow',
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        }
    });
    const longUrl = res.url;
    console.log('Resolved Long URL:', longUrl);

    // 2. Query TikWM with short URL
    try {
        const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(shortUrl)}`;
        const tikwmRes = await fetch(tikwmUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tikwm.com/'
            }
        });
        const json = await tikwmRes.json();
        console.log(`Short URL Query: code=${json.code}, msg="${json.msg}"`);
    } catch (e) {
        console.error('Short URL Error:', e.message);
    }

    // 3. Query TikWM with resolved long URL
    try {
        const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(longUrl)}`;
        const tikwmRes = await fetch(tikwmUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tikwm.com/'
            }
        });
        const json = await tikwmRes.json();
        console.log(`Long URL Query: code=${json.code}, msg="${json.msg}"`);
    } catch (e) {
        console.error('Long URL Error:', e.message);
    }
}

run().catch(console.error);
