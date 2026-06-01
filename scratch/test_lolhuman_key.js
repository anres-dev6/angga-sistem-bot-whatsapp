import fetch from 'node-fetch';

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';
const apikey = '8e922dbb3149ef7df291cc45';

async function run() {
    try {
        console.log('Testing Lolhuman with key 8e922dbb3149ef7df291cc45...');
        const endpoint = `https://api.lolhuman.xyz/api/instagram?apikey=${apikey}&url=${encodeURIComponent(testUrl)}`;
        const res = await fetch(endpoint);
        const json = await res.json();
        console.log('Lolhuman response status:', res.status);
        console.log('Lolhuman response:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.log('Lolhuman test failed:', e.message);
    }
}
run();
