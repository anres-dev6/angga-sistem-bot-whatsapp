import fs from 'fs';
import sharp from 'sharp';

function wrapText(text, maxCharsPerLine = 13) {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3);
}

const getFontSize = (lines) => {
    if (lines.length === 0) return 0;
    const maxLen = Math.max(...lines.map(l => l.length));
    // Let's make it even larger for ultimate prominence!
    // target width is 470px out of 512px.
    let size = Math.floor(470 / (maxLen * 0.52));
    if (size < 35) size = 35;
    if (size > 75) size = 75; // Even larger cap!
    return size;
};

async function testBulletproofMeme() {
    console.log("=== RUNNING BULLETPROOF MEME GENERATOR TEST ===");
    
    const baseBuffer = fs.readFileSync('data/qris.png');
    
    // We do it all in a single direct sharp pipeline to avoid intermediate PNG buffer loss
    const top = "MERASAKAN".toUpperCase();
    const bottom = "AKAN: JANGAN OM".toUpperCase();

    const topLines = wrapText(top, 13);
    const bottomLines = wrapText(bottom, 13);

    const topFontSize = getFontSize(topLines);
    const bottomFontSize = getFontSize(bottomLines);

    console.log(`Top Lines: ${JSON.stringify(topLines)} (Font: ${topFontSize}px)`);
    console.log(`Bottom Lines: ${JSON.stringify(bottomLines)} (Font: ${bottomFontSize}px)`);

    let textOverlaySvg = '';

    // Render top text lines inline
    if (topLines.length > 0) {
        const topLineHeight = topFontSize * 1.1;
        topLines.forEach((line, idx) => {
            const y = 25 + idx * topLineHeight + topLineHeight / 2;
            const escaped = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
            
            const strokeWidth = Math.max(3.5, topFontSize * 0.11);
            
            // Notice: unitless font-size and stroke-width, combined with explicit font-family list
            textOverlaySvg += `<text x="256" y="${y}" font-family="Impact, 'Arial Black', Anton, sans-serif" font-weight="900" font-size="${topFontSize}" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${escaped}</text>\n`;
        });
    }

    // Render bottom text lines inline
    if (bottomLines.length > 0) {
        const bottomLineHeight = bottomFontSize * 1.1;
        const totalHeight = bottomLines.length * bottomLineHeight;
        const startY = 490 - totalHeight;

        bottomLines.forEach((line, idx) => {
            const y = startY + idx * bottomLineHeight + bottomLineHeight / 2;
            const escaped = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

            const strokeWidth = Math.max(3.5, bottomFontSize * 0.11);
            textOverlaySvg += `<text x="256" y="${y}" font-family="Impact, 'Arial Black', Anton, sans-serif" font-weight="900" font-size="${bottomFontSize}" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${escaped}</text>\n`;
        });
    }

    // Notice: viewBox forcing a 1:1 pixel coordinate map, and an explicit density check
    const svgOverlay = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="none" />
        ${textOverlaySvg}
    </svg>
    `;

    const finalBuffer = await sharp(baseBuffer)
        .rotate()
        .ensureAlpha()
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
        .webp({ quality: 90 })
        .toBuffer();

    fs.writeFileSync('scratch/test_smeme_bulletproof_out.webp', finalBuffer);
    console.log("✅ SUCCESS! Bulletproof meme saved to scratch/test_smeme_bulletproof_out.webp");
}

testBulletproofMeme().catch(console.error);
