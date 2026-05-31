import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { exec } from 'child_process';
import { tmpdir } from 'os';

function wrapText(text, maxCharsPerLine = 12) {
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
    return lines.slice(0, 5); // Limit to max 5 lines
}

async function generateLocalAttp(text) {
    const totalFrames = 15;
    const tempDir = path.join(tmpdir(), `attp-${Date.now()}`);
    fs.mkdirSync(tempDir);
    
    console.log(`Temp directory created: ${tempDir}`);
    
    const lines = wrapText(text, 10);
    console.log('Wrapped lines:', lines);
    
    const maxLineLen = Math.max(...lines.map(l => l.length));
    
    let fontSize = 75;
    if (maxLineLen > 5) fontSize = Math.floor(450 / (maxLineLen * 0.8));
    if (lines.length > 2) fontSize = Math.min(fontSize, Math.floor(250 / lines.length));
    if (fontSize < 24) fontSize = 24;
    if (fontSize > 85) fontSize = 85;
    
    const lineHeight = fontSize * 1.15;
    const totalHeight = (lines.length - 1) * lineHeight;
    const startY = 256 - totalHeight / 2;
    
    console.log(`Max line length: ${maxLineLen}, Total lines: ${lines.length}, Font size: ${fontSize}, StartY: ${startY}`);
    
    // Generate SVG frames
    const framePaths = [];
    for (let i = 0; i < totalFrames; i++) {
        const hueShift = (i * (360 / totalFrames)) % 360;
        
        const c1 = `hsl(${hueShift}, 100%, 55%)`;
        const c2 = `hsl(${(hueShift + 60) % 360}, 100%, 55%)`;
        const c3 = `hsl(${(hueShift + 120) % 360}, 100%, 55%)`;
        const c4 = `hsl(${(hueShift + 180) % 360}, 100%, 55%)`;
        const c5 = `hsl(${(hueShift + 240) % 360}, 100%, 55%)`;
        const c6 = `hsl(${(hueShift + 300) % 360}, 100%, 55%)`;
        
        let textContentSvg = '';
        lines.forEach((line, idx) => {
            const y = startY + idx * lineHeight;
            // Escape XML entities
            const escapedLine = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
            textContentSvg += `<text x="256" y="${y}" class="text">${escapedLine}</text>\n`;
        });
        
        const svg = `
        <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${c1}" />
                    <stop offset="20%" stop-color="${c2}" />
                    <stop offset="40%" stop-color="${c3}" />
                    <stop offset="60%" stop-color="${c4}" />
                    <stop offset="80%" stop-color="${c5}" />
                    <stop offset="100%" stop-color="${c6}" />
                </linearGradient>
                <style>
                    .text {
                        font-family: 'Impact', 'Arial Black', 'Arial', sans-serif;
                        font-weight: 900;
                        font-size: ${fontSize}px;
                        fill: url(#rainbowGrad);
                        stroke: #000000;
                        stroke-width: ${fontSize * 0.16}px;
                        stroke-linejoin: round;
                        paint-order: stroke fill;
                        text-anchor: middle;
                        dominant-baseline: middle;
                    }
                </style>
            </defs>
            <rect width="100%" height="100%" fill="none" />
            ${textContentSvg}
        </svg>
        `;
        
        const framePath = path.join(tempDir, `frame_${String(i).padStart(3, '0')}.png`);
        await sharp(Buffer.from(svg))
            .png()
            .toFile(framePath);
            
        framePaths.push(framePath);
    }
    
    const outputWebp = path.join(tempDir, 'output.webp');
    const cmd = `ffmpeg -framerate 15 -i "${path.join(tempDir, 'frame_%03d.png')}" -vcodec libwebp -filter_complex "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0.0" -loop 0 -an -vsync 0 "${outputWebp}"`;
    
    return new Promise((resolve, reject) => {
        exec(cmd, (err) => {
            if (err) return reject(err);
            const webpBuffer = fs.readFileSync(outputWebp);
            
            // Cleanup
            for (const fp of framePaths) fs.unlinkSync(fp);
            fs.unlinkSync(outputWebp);
            fs.rmdirSync(tempDir);
            
            resolve(webpBuffer);
        });
    });
}

async function test() {
    try {
        console.log('Testing wrapping multi-line...');
        const buffer = await generateLocalAttp('Halo Dunia yang Indah Sekali');
        fs.writeFileSync('scratch/test_attp_wrap_output.webp', buffer);
        console.log('SUCCESS! Generated multi-line WebP saved to scratch/test_attp_wrap_output.webp');
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
