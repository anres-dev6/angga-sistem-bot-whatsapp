import instagramDl from '@sasmeee/igdl';

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';

async function run() {
    try {
        console.log('Testing @sasmeee/igdl with:', testUrl);
        const data = await instagramDl(testUrl);
        console.log('Download Result:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('Download failed:', e.message);
    }
}
run();
