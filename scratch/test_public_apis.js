import fetch from 'node-fetch';
import https from 'https';

// Bypass SSL self-signed certificate checks
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';
const capcutUrl = 'https://www.capcut.com/t/Zs8R7XhUv/';

async function testApi(name, endpoint) {
    try {
        console.log(`[Testing ${name}] calling...`);
        const res = await fetch(endpoint, { 
            timeout: 15000,
            agent: new https.Agent({ rejectUnauthorized: false })
        });
        const text = await res.text();
        console.log(`[${name} Status]: ${res.status}`);
        try {
            const json = JSON.parse(text);
            console.log(`[${name} JSON]:`, JSON.stringify(json, null, 2).substring(0, 500));
        } catch {
            console.log(`[${name} HTML/Text Snippet]:`, text.substring(0, 200));
        }
    } catch (e) {
        console.log(`[${name} Failed]:`, e.message);
    }
    console.log('------------------------------------');
}

async function run() {
    // 1. Tiklydown (Bypassed TLS)
    await testApi('Tiklydown (Bypassed TLS)', `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(testUrl)}`);
    
    // 2. Botcahx (New Domain)
    await testApi('Botcahx (New Domain)', `https://api.botcahx.eu.org/api/dowloader/instagram?apikey=free&url=${encodeURIComponent(testUrl)}`);
    
    // 3. Botcahx Capcut
    await testApi('Botcahx Capcut', `https://api.botcahx.eu.org/api/dowloader/capcut?apikey=free&url=${encodeURIComponent(capcutUrl)}`);
    
    // 4. Widipe (New Domain)
    await testApi('Widipe (New Domain)', `https://api.widipe.biz.id/download/ig?url=${encodeURIComponent(testUrl)}`);
    
    // 5. Widipe Capcut
    await testApi('Widipe Capcut', `https://api.widipe.biz.id/download/capcut?url=${encodeURIComponent(capcutUrl)}`);
}

run();
