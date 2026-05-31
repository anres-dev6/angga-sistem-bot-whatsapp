import sharp from 'sharp';

async function scan() {
    const image = sharp('scratch/test_smeme_ultimate_out.webp');
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    // Scan the top 120 rows for white pixels
    let topWhite = 0;
    for (let y = 0; y < 120; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * info.channels;
            if (data[idx] > 240 && data[idx+1] > 240 && data[idx+2] > 240) {
                topWhite++;
            }
        }
    }
    
    // Scan the bottom 120 rows for white pixels
    let bottomWhite = 0;
    for (let y = info.height - 120; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * info.channels;
            if (data[idx] > 240 && data[idx+1] > 240 && data[idx+2] > 240) {
                bottomWhite++;
            }
        }
    }
    
    console.log("=== ULTIMATE PIXEL SCAN ===");
    console.log(`Top white pixels (massive font): ${topWhite}`);
    console.log(`Bottom white pixels (massive font): ${bottomWhite}`);
}

scan().catch(console.error);
