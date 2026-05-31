import fs from 'fs';
import sharp from 'sharp';

function wrapText(text, maxCharsPerLine = 16) {
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
    let size = Math.floor(450 / (maxLen * 0.55));
    if (size < 30) size = 30;
    if (size > 55) size = 55;
    return size;
};

async function processMeme(inputPath, outputPath, topText, bottomText) {
    console.log(`Processing ${inputPath} -> ${outputPath}`);
    const buffer = fs.readFileSync(inputPath);
    
    const baseImage = await sharp(buffer)
        .rotate()
        .ensureAlpha()
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

    const top = topText.toUpperCase();
    const bottom = bottomText.toUpperCase();

    const topLines = wrapText(top, 16);
    const bottomLines = wrapText(bottom, 16);

    const topFontSize = getFontSize(topLines);
    const bottomFontSize = getFontSize(bottomLines);

    console.log(`- Top Font Size: ${topFontSize}px, Lines: ${JSON.stringify(topLines)}`);
    console.log(`- Bottom Font Size: ${bottomFontSize}px, Lines: ${JSON.stringify(bottomLines)}`);

    let textOverlaySvg = '';

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

    const finalBuffer = await sharp(baseImage)
        .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
        .webp({ quality: 90 })
        .toBuffer();

    fs.writeFileSync(outputPath, finalBuffer);
    console.log(`✅ Success writing ${outputPath}`);
}

async function run() {
    // 1. Test with a PNG image (qris.png)
    if (fs.existsSync('data/qris.png')) {
        await processMeme('data/qris.png', 'scratch/test_smeme_image_out.webp', 'AKU PAS DOSEN BILANG', 'CUMA 1 SOAL SAJA');
    } else {
        console.log('data/qris.png not found, skipping image test');
    }
    
    // 2. Test with a sticker (test_qc_output.webp)
    if (fs.existsSync('scratch/test_qc_output.webp')) {
        await processMeme('scratch/test_qc_output.webp', 'scratch/test_smeme_sticker_out.webp', 'INI MEME DARI', 'SEBUAH STIKER WA');
    } else {
        console.log('scratch/test_qc_output.webp not found, skipping sticker test');
    }
}

run().catch(console.error);
