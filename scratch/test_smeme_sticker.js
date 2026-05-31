import fs from 'fs';
import sharp from 'sharp';

async function test() {
    console.log('--- Testing smeme sticker input composition ---');
    
    const stickerPath = 'scratch/test_qc_output.webp';
    if (!fs.existsSync(stickerPath)) {
        console.error(`❌ Input sticker ${stickerPath} does not exist! Please run test_qc.js first.`);
        return;
    }
    
    const stickerBuffer = fs.readFileSync(stickerPath);
    
    // 1. Convert WebP sticker to 1:1 padded transparent PNG
    const baseImage = await sharp(stickerBuffer)
        .rotate()
        .ensureAlpha()
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
        
    // 2. SVG Text overlay
    const topText = 'STIKER DI-MEME-IN';
    const bottomText = 'MEME DARI STIKER';
    
    const topFontSize = 36;
    const bottomFontSize = 36;
    
    const svgOverlay = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="none" />
        <!-- Top text -->
        <text x="256" y="50" font-family="Anton, Impact, sans-serif" font-weight="900" font-size="${topFontSize}px" fill="#ffffff" stroke="#000000" stroke-width="${topFontSize * 0.2}px" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${topText}</text>
        <!-- Bottom text -->
        <text x="256" y="462" font-family="Anton, Impact, sans-serif" font-weight="900" font-size="${bottomFontSize}px" fill="#ffffff" stroke="#000000" stroke-width="${bottomFontSize * 0.2}px" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${bottomText}</text>
    </svg>
    `;
    
    // 3. Composite in-memory
    const finalBuffer = await sharp(baseImage)
        .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
        .webp({ quality: 90 })
        .toBuffer();
        
    fs.writeFileSync('scratch/test_smeme_sticker_output.webp', finalBuffer);
    console.log('✅ SUCCESS! Composited meme sticker saved to scratch/test_smeme_sticker_output.webp');
}

test().catch(console.error);
