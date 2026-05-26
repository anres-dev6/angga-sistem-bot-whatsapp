import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
    igdl,
    ttdl,
    fbdown,
    twitter,
    youtube
} = require('ab-downloader');

const test = async () => {
    try {
        console.log("--- TIKTOK TEST ---");
        const tt = await ttdl('https://www.tiktok.com/@omahi.tiktok/video/7438676229340941573');
        console.log(JSON.stringify(tt, null, 2));
    } catch (e) { console.log("TT Error:", e.message); }

    try {
        console.log("\n--- IG TEST ---");
        const ig = await igdl('https://www.instagram.com/reel/C2_r8q_S_wP/');
        console.log(JSON.stringify(ig, null, 2));
    } catch (e) { console.log("IG Error:", e.message); }

    try {
        console.log("\n--- TWITTER TEST ---");
        const tw = await twitter('https://twitter.com/Twitter/status/1556443497554554881');
        console.log(JSON.stringify(tw, null, 2));
    } catch (e) { console.log("TW Error:", e.message); }
};

test();
