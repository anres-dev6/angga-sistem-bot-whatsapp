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
    
    // Proportional base size
    let size = Math.floor(480 / (maxLen * 0.5));
    
    // Dynamic caps depending on number of lines to prevent image coverage
    let maxCap = 100; // 1 Line can be HUGE
    if (lines.length === 2) maxCap = 75;
    if (lines.length === 3) maxCap = 55;
    
    let minCap = 35;
    if (lines.length === 1) minCap = 50; // Single line should always be prominent
    
    if (size < minCap) size = minCap;
    if (size > maxCap) size = maxCap;
    return size;
};

const testCases = [
    { top: "MERASAKAN", bottom: "AKAN: JANGAN OM" },
    { top: "AKU PAS LIAT", bottom: "NILAI UTS KELUAR" },
    { top: "HEBAT", bottom: "" },
    { top: "", bottom: "CUMA 1 SOAL" }
];

async function runTest() {
    console.log("=== RUNNING ULTIMATE MEME SIZE SIMULATOR ===");
    for (const tc of testCases) {
        const topLines = wrapText(tc.top.toUpperCase(), 13);
        const bottomLines = wrapText(tc.bottom.toUpperCase(), 13);
        
        const topSize = getFontSize(topLines);
        const bottomSize = getFontSize(bottomLines);
        
        console.log(`\nInput: Top="${tc.top}", Bottom="${tc.bottom}"`);
        console.log(`Top wrapped: ${JSON.stringify(topLines)} -> Size: ${topSize}px`);
        console.log(`Bottom wrapped: ${JSON.stringify(bottomLines)} -> Size: ${bottomSize}px`);
    }
    
    // Generate a physical sample for the "MERASAKAN" case
    const baseBuffer = fs.readFileSync('data/qris.png');
    const topLines = wrapText("MERASAKAN", 13);
    const bottomLines = wrapText("AKAN: JANGAN OM", 13);
    const topFontSize = getFontSize(topLines);
    const bottomFontSize = getFontSize(bottomLines);
    
    let textOverlaySvg = '';
    
    if (topLines.length > 0) {
        const topLineHeight = topFontSize * 1.1;
        topLines.forEach((line, idx) => {
            const y = 25 + idx * topLineHeight + topLineHeight / 2;
            const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const strokeWidth = Math.max(3.5, topFontSize * 0.11);
            
            // Bulletproof font-size and stroke-width in both attributes and CSS style tag!
            textOverlaySvg += `<text x="256" y="${y}" font-family="Impact, 'Arial Black', Anton, sans-serif" font-weight="900" font-size="${topFontSize}" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em" style="font-size: ${topFontSize}px; stroke-width: ${strokeWidth}px; font-family: Impact, 'Arial Black', Anton, sans-serif; font-weight: 900;">${escaped}</text>\n`;
        });
    }
    
    if (bottomLines.length > 0) {
        const bottomLineHeight = bottomFontSize * 1.1;
        const totalHeight = bottomLines.length * bottomLineHeight;
        const startY = 490 - totalHeight;
        
        bottomLines.forEach((line, idx) => {
            const y = startY + idx * bottomLineHeight + bottomLineHeight / 2;
            const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const strokeWidth = Math.max(3.5, bottomFontSize * 0.11);
            
            textOverlaySvg += `<text x="256" y="${y}" font-family="Impact, 'Arial Black', Anton, sans-serif" font-weight="900" font-size="${bottomFontSize}" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em" style="font-size: ${bottomFontSize}px; stroke-width: ${strokeWidth}px; font-family: Impact, 'Arial Black', Anton, sans-serif; font-weight: 900;">${escaped}</text>\n`;
        });
    }
    
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
        
    fs.writeFileSync('scratch/test_smeme_ultimate_out.webp', finalBuffer);
    console.log("\n✅ SUCCESS! Ultimate sample saved to scratch/test_smeme_ultimate_out.webp");
}

runTest().catch(console.error);
