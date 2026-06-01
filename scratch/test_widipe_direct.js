import fetch from 'node-fetch';

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';

async function test(name, url) {
    try {
        console.log(`[Testing ${name}] calling...`);
        const res = await fetch(url, { timeout: 10000 });
        const text = await res.text();
        console.log(`[${name} Status]: ${res.status}`);
        try {
            const json = JSON.parse(text);
            console.log(`[${name} JSON]:`, JSON.stringify(json, null, 2).substring(0, 500));
        } catch {
            console.log(`[${name} HTML/Text Snippet]:`, text.substring(0, 150));
        }
    } catch (e) {
        console.log(`[${name} Failed]:`, e.message);
    }
    console.log('------------------------------------');
}

async function run() {
    await test('Widipe com (No api subdomain)', `https://widipe.com/download/ig?url=${encodeURIComponent(testUrl)}`);
    await test('Widipe biz.id (No api subdomain)', `https://widipe.biz.id/download/ig?url=${encodeURIComponent(testUrl)}`);
    await test('Widipe com instagram (No api subdomain)', `https://widipe.com/instagram?url=${encodeURIComponent(testUrl)}`);
    await test('Widipe biz.id instagram (No api subdomain)', `https://widipe.biz.id/instagram?url=${encodeURIComponent(testUrl)}`);
}
run();
