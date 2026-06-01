import ig from 'instagram-url-direct';
const instagramGetUrl = ig.instagramGetUrl || ig.default?.instagramGetUrl;

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';

async function run() {
    try {
        console.log('Calling instagramGetUrl with:', testUrl);
        const data = await instagramGetUrl(testUrl);
        console.log('Result:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('Failed:', e.message);
    }
}
run();
