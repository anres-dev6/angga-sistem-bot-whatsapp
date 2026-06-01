import { igdl, capcut, fbdown, douyin } from 'btch-downloader';

async function run() {
    try {
        console.log('Testing Capcut with a template URL...');
        const cpData = await capcut('https://www.capcut.com/t/Zs8R7XhUv/');
        console.log('Capcut response:', JSON.stringify(cpData, null, 2));
    } catch (e) {
        console.log('Capcut failed:', e.message);
    }

    try {
        console.log('Testing Instagram...');
        const igData = await igdl('https://www.instagram.com/reel/C8q_t_XyQ7t/');
        console.log('Instagram response:', JSON.stringify(igData, null, 2));
    } catch (e) {
        console.log('Instagram failed:', e.message);
    }
}
run();
