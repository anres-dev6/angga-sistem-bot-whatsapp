import fetch from 'node-fetch';

async function run() {
    const url = 'https://www.tiktok.com/@jokowi/video/7279188448889441541';
    
    // Test TikWM
    try {
        const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        console.log('Querying TikWM:', tikwmUrl);
        const res = await fetch(tikwmUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        const text = await res.text();
        console.log('TikWM Raw Response:', text);
    } catch (e) {
        console.error('TikWM Error:', e.message);
    }

    // Test Tiklydown v3
    try {
        const tiklyUrl = `https://api.tiklydown.eu.org/api/download/v3?url=${encodeURIComponent(url)}`;
        console.log('\nQuerying Tiklydown v3:', tiklyUrl);
        const res = await fetch(tiklyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const text = await res.text();
        console.log('Tiklydown v3 Raw Response:', text);
    } catch (e) {
        console.error('Tiklydown v3 Error:', e.message);
    }

    // Test Tiklydown v2
    try {
        const tiklyUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`;
        console.log('\nQuerying Tiklydown v1/v2:', tiklyUrl);
        const res = await fetch(tiklyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const text = await res.text();
        console.log('Tiklydown v1/v2 Raw Response:', text);
    } catch (e) {
        console.error('Tiklydown v1/v2 Error:', e.message);
    }
}

run().catch(console.error);
