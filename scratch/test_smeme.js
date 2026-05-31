import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

function wrapText(text, maxCharsPerLine = 18) {
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
    return lines.slice(0, 3); // Limit to max 3 lines per block to prevent covering too much image
}

async function testSmeme(topText, bottomText) {
    console.log('--- Testing smeme overlay rendering ---');
    
    // Create a 16:9 dummy landscape image to simulate a user photo
    const dummySvg = `
    <svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="gray" />
        <circle cx="400" cy="225" r="150" fill="lightblue" />
        <text x="400" y="225" font-family="sans-serif" font-size="30" fill="black" text-anchor="middle">MAIN OBJECT (CENTER)</text>
    </svg>
    `;
    const dummyPng = await sharp(Buffer.from(dummySvg)).png().toBuffer();
    
    // 1. Resize base image to 1:1 (512x512) transparent padded square
    const baseImage = await sharp(dummyPng)
        .rotate()
        .ensureAlpha()
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
        
    // 2. Parse and format texts
    const top = (topText || '').trim().toUpperCase();
    const bottom = (bottomText || '').trim().toUpperCase();
    
    const topLines = wrapText(top, 16);
    const bottomLines = wrapText(bottom, 16);
    
    console.log('Top wrapped lines:', topLines);
    console.log('Bottom wrapped lines:', bottomLines);
    
    // 3. Dynamic sizing & positions
    const getFontSize = (lines) => {
        if (lines.length === 0) return 0;
        const maxLen = Math.max(...lines.map(l => l.length));
        let size = 42;
        if (maxLen > 8) size = Math.floor(380 / (maxLen * 0.9));
        if (size < 24) size = 24;
        if (size > 46) size = 46;
        return size;
    };
    
    const topFontSize = getFontSize(topLines);
    const bottomFontSize = getFontSize(bottomLines);
    
    let textOverlaySvg = '';
    
    // Add top text
    if (topLines.length > 0) {
        const topLineHeight = topFontSize * 1.15;
        topLines.forEach((line, idx) => {
            const y = 35 + idx * topLineHeight + topLineHeight / 2;
            const escaped = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
                
            textOverlaySvg += `<text x="256" y="${y}" font-family="Anton, Impact, sans-serif" font-weight="900" font-size="${topFontSize}px" fill="#ffffff" stroke="#000000" stroke-width="${topFontSize * 0.2}px" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${escaped}</text>\n`;
        });
    }
    
    // Add bottom text
    if (bottomLines.length > 0) {
        const bottomLineHeight = bottomFontSize * 1.15;
        const totalHeight = bottomLines.length * bottomLineHeight;
        const startY = 485 - totalHeight;
        
        bottomLines.forEach((line, idx) => {
            const y = startY + idx * bottomLineHeight + bottomLineHeight / 2;
            const escaped = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
                
            textOverlaySvg += `<text x="256" y="${y}" font-family="Anton, Impact, sans-serif" font-weight="900" font-size="${bottomFontSize}px" fill="#ffffff" stroke="#000000" stroke-width="${bottomFontSize * 0.2}px" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${escaped}</text>\n`;
        });
    }
    
    const svgOverlay = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="none" />
        ${textOverlaySvg}
    </svg>
    `;
    
    // 4. Composite the overlay on top of the base padded image
    const finalMemeBuffer = await sharp(baseImage)
        .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
        .webp({ quality: 90 })
        .toBuffer();
        
    fs.writeFileSync('scratch/test_smeme_output.webp', finalMemeBuffer);
    console.log('SUCCESS! Generated smeme sticker saved to scratch/test_smeme_output.webp');
}

testSmeme('AKU PAS DOSEN BILANG', 'CUMA ADA SATU SOAL UJIAN');
