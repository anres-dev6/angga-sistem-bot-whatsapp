import { twitter, igdl } from 'ab-downloader';

const testTwitter = async () => {
    try {
        console.log("Testing Twitter...");
        const res = await twitter('https://twitter.com/Twitter/status/1556443497554554881'); // Example tweet
        console.log("Twitter Result:", JSON.stringify(res, null, 2));
    } catch (e) {
        console.error("Twitter Error:", e);
    }
};

const testIg = async () => {
    try {
        console.log("Testing IG...");
        const res = await igdl('https://www.instagram.com/reel/C2_r8q_S_wP/'); // Example Reel
        console.log("IG Result:", JSON.stringify(res, null, 2));
    } catch (e) {
        console.error("IG Error:", e);
    }
};

(async () => {
    await testTwitter();
    // await testIg(); // Uncomment if needed
})();
