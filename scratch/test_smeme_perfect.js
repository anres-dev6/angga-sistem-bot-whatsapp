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
    // Anton/Impact are narrow. For maxLen = 9 ("MERASAKAN"), 460 / (9 * 0.6) = 85px -> Capped at 70px is extremely prominent and safe.
    let size = Math.floor(460 / (maxLen * 0.55));
    if (size < 35) size = 35;
    if (size > 70) size = 70; // High prominent cap matching the reference image
    return size;
};

async function testPerfectMeme() {
    console.log("=== RUNNING PERFECT MEME GENERATOR TEST ===");
    
    // We will use qris.png or a generic canvas if qris.png is missing
    const baseBuffer = fs.readFileSync('data/qris.png');
    
    const baseImage = await sharp(baseBuffer)
        .rotate()
        .ensureAlpha()
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

    const top = "MERASAKAN".toUpperCase();
    const bottom = "AKAN: JANGAN OM".toUpperCase();

    const topLines = wrapText(top, 13);
    const bottomLines = wrapText(bottom, 13);

    const topFontSize = getFontSize(topLines);
    const bottomFontSize = getFontSize(bottomLines);

    console.log(`Top Lines: ${JSON.stringify(topLines)} (Font: ${topFontSize}px)`);
    console.log(`Bottom Lines: ${JSON.stringify(bottomLines)} (Font: ${bottomFontSize}px)`);

    let textOverlaySvg = '';

    if (topLines.length > 0) {
        const topLineHeight = topFontSize * 1.1;
        topLines.forEach((line, idx) => {
            // Safe top margin starting at 25px
            const y = 25 + idx * topLineHeight + topLineHeight / 2;
            const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            // Clean outline (stroke-width around 0.12 of font-size or constant 4.5px/5px for crisp looks)
            const strokeWidth = Math.max(3.5, topFontSize * 0.1);
            textOverlaySvg += `<text x="256" y="${y}" font-family="Anton, Impact, sans-serif" font-weight="900" font-size="${topFontSize}px" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}px" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${escaped}</text>\n`;
        });
    }

    if (bottomLines.length > 0) {
        const bottomLineHeight = bottomFontSize * 1.1;
        const totalHeight = bottomLines.length * bottomLineHeight;
        // Keep inside safety margins of 512px canvas (startY around 490 - totalHeight)
        const startY = 490 - totalHeight;

        bottomLines.forEach((line, idx) => {
            const y = startY + idx * bottomLineHeight + bottomLineHeight / 2;
            const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const strokeWidth = Math.max(3.5, bottomFontSize * 0.1);
            textOverlaySvg += `<text x="256" y="${y}" font-family="Anton, Impact, sans-serif" font-weight="900" font-size="${bottomFontSize}px" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}px" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${escaped}</text>\n`;
        });
    }

    const svgOverlay = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="none" />
        ${textOverlaySvg}
    </svg>
    `;

    const finalBuffer = await sharp(baseImage)
        .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
        .webp({ quality: 90 })
        .toBuffer();

    fs.writeFileSync('scratch/test_smeme_perfect_out.webp', finalBuffer);
    console.log("✅ SUCCESS! Perfect meme saved to scratch/test_smeme_perfect_out.webp");
}

testPerfectMeme().catch(console.error);
