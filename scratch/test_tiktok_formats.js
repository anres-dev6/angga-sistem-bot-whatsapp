import fetch from 'node-fetch';

async function run() {
    const urls = [
        'https://www.tiktok.com/@jokowi/video/7279188448889441541',
        'https://tiktok.com/@jokowi/video/7279188448889441541',
        'https://www.tiktok.com/v/7279188448889441541',
        'https://tiktok.com/v/7279188448889441541',
        'https://www.tiktok.com/video/7279188448889441541'
    ];
    
    for (const url of urls) {
        try {
            const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            const res = await fetch(tikwmUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.tikwm.com/'
                }
            });
            const json = await res.json();
            console.log(`URL: ${url}`);
            console.log(`Response: code=${json.code}, msg="${json.msg}"`, json.data ? 'data=Available' : '');
            console.log('----------------------------------------------------');
        } catch (e) {
            console.error(`Error for ${url}:`, e.message);
        }
    }
}

run().catch(console.error);
