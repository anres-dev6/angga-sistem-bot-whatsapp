import instagramGetUrl from 'priyansh-ig-downloader';

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';

async function run() {
    try {
        console.log('Testing priyansh-ig-downloader with:', testUrl);
        const data = await instagramGetUrl(testUrl);
        console.log('Result:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('Failed:', e.message);
    }
}
run();
