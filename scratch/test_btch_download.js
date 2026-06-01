import { igdl, capcut, fbdown, douyin } from 'btch-downloader';

const testInstagramUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';
const testCapcutUrl = 'https://www.capcut.com/t/Zs8R7XhUv/';
const testFbUrl = 'https://www.facebook.com/watch/?v=382710187843818';
const testDouyinUrl = 'https://v.douyin.com/i2SSh4L/';

async function test(name, fn, url) {
    try {
        console.log(`[Testing ${name}] calling with url: ${url}`);
        const result = await fn(url);
        console.log(`[${name} Result]:`, JSON.stringify(result, null, 2));
    } catch (e) {
        console.log(`[${name} Failed]:`, e.message);
    }
    console.log('------------------------------------');
}

async function run() {
    await test('Instagram (igdl)', igdl, testInstagramUrl);
    await test('CapCut (capcut)', capcut, testCapcutUrl);
    await test('Facebook (fbdown)', fbdown, testFbUrl);
    await test('Douyin (douyin)', douyin, testDouyinUrl);
}
run();
