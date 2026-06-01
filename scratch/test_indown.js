import fetch from 'node-fetch';

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';

async function testIndown() {
    try {
        console.log('Testing indown.io API...');
        const res = await fetch('https://indown.io/api/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({ link: testUrl, locale: 'id', index: 0 })
        });
        console.log('indown.io response status:', res.status);
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            console.log('indown.io JSON:', JSON.stringify(json, null, 2));
        } catch {
            console.log('indown.io Text:', text.substring(0, 500));
        }
    } catch (e) {
        console.log('indown.io failed:', e.message);
    }
}

testIndown();
