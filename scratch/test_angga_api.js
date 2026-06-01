import fetch from 'node-fetch';

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';
const capcutUrl = 'https://www.capcut.com/t/Zs8R7XhUv/';

async function test(name, url) {
    try {
        console.log(`[Testing ${name}] calling...`);
        const res = await fetch(url, { timeout: 15000 });
        const text = await res.text();
        console.log(`[${name} Status]: ${res.status}`);
        try {
            const json = JSON.parse(text);
            console.log(`[${name} JSON]:`, JSON.stringify(json, null, 2).substring(0, 1000));
        } catch {
            console.log(`[${name} Text Snippet]:`, text.substring(0, 200));
        }
    } catch (e) {
        console.log(`[${name} Failed]:`, e.message);
    }
    console.log('------------------------------------');
}

async function run() {
    await test('Angga Instagram', `https://api-g4nggaa.biz.id/api/download/instagram?url=${encodeURIComponent(testUrl)}`);
    await test('Angga CapCut', `https://api-g4nggaa.biz.id/api/download/capcut?url=${encodeURIComponent(capcutUrl)}`);
}
run();
