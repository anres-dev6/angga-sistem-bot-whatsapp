import sharp from 'sharp';

async function checkPixels() {
    console.log("=== SCANNING MEME WEB STICKER PIXELS ===");
    const image = sharp('scratch/test_smeme_perfect_out.webp');
    const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });
        
    console.log(`Dimensions: ${info.width}x${info.height}, Channels: ${info.channels}`);
    
    // Scan the top 100 rows for white pixels (R > 240, G > 240, B > 240)
    let topWhitePixelsCount = 0;
    for (let y = 0; y < 100; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * info.channels;
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            const a = data[idx+3];
            
            // White text color fill
            if (r > 245 && g > 245 && b > 245 && a > 200) {
                topWhitePixelsCount++;
            }
        }
    }
    
    // Scan the bottom 100 rows for white pixels
    let bottomWhitePixelsCount = 0;
    for (let y = info.height - 100; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * info.channels;
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            const a = data[idx+3];
            
            if (r > 245 && g > 245 && b > 245 && a > 200) {
                bottomWhitePixelsCount++;
            }
        }
    }
    
    console.log(`Top white pixels found: ${topWhitePixelsCount}`);
    console.log(`Bottom white pixels found: ${bottomWhitePixelsCount}`);
    
    if (topWhitePixelsCount > 100 && bottomWhitePixelsCount > 100) {
        console.log("✅ Text is successfully rendered and occupies large areas!");
    } else {
        console.log("❌ CRITICAL: Little or no white pixels found! Text rendering is microscopic or invisible.");
    }
}

checkPixels().catch(console.error);
