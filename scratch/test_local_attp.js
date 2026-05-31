import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { exec } from 'child_process';
import { tmpdir } from 'os';

// Test local ATTP generation using SVG frames and FFmpeg
async function generateLocalAttp(text) {
    const totalFrames = 15;
    const tempDir = path.join(tmpdir(), `attp-${Date.now()}`);
    fs.mkdirSync(tempDir);
    
    console.log(`Temp directory created: ${tempDir}`);
    
    // Auto-calculate font size based on text length
    // We want the text to fit within 512x512
    const textLength = text.length;
    let fontSize = 80;
    if (textLength > 5) fontSize = Math.floor(400 / (textLength * 0.7));
    if (fontSize < 24) fontSize = 24;
    if (fontSize > 90) fontSize = 90;
    
    console.log(`Text length: ${textLength}, Font size: ${fontSize}`);
    
    // Generate SVG frames
    const framePaths = [];
    for (let i = 0; i < totalFrames; i++) {
        // Shifting hue for the rainbow effect
        const hueShift = (i * (360 / totalFrames)) % 360;
        
        // Define a multi-stop rainbow gradient shifting in hue
        const c1 = `hsl(${hueShift}, 100%, 50%)`;
        const c2 = `hsl(${(hueShift + 60) % 360}, 100%, 50%)`;
        const c3 = `hsl(${(hueShift + 120) % 360}, 100%, 50%)`;
        const c4 = `hsl(${(hueShift + 180) % 360}, 100%, 50%)`;
        const c5 = `hsl(${(hueShift + 240) % 360}, 100%, 50%)`;
        const c6 = `hsl(${(hueShift + 300) % 360}, 100%, 50%)`;
        
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
                        font-family: 'Arial', sans-serif;
                        font-weight: 900;
                        font-size: ${fontSize}px;
                        fill: url(#rainbowGrad);
                        stroke: #000000;
                        stroke-width: ${fontSize * 0.08}px;
                        stroke-linejoin: round;
                        text-anchor: middle;
                        dominant-baseline: middle;
                    }
                </style>
            </defs>
            <!-- Background is transparent -->
            <rect width="100%" height="100%" fill="none" />
            <text x="256" y="256" class="text">${text}</text>
        </svg>
        `;
        
        const framePath = path.join(tempDir, `frame_${String(i).padStart(3, '0')}.png`);
        
        // Render SVG to PNG using Sharp
        await sharp(Buffer.from(svg))
            .png()
            .toFile(framePath);
            
        framePaths.push(framePath);
    }
    
    console.log(`Rendered ${totalFrames} frames.`);
    
    const outputWebp = path.join(tempDir, 'output.webp');
    
    // Call FFmpeg to compile the frames into an animated WebP
    // We use a high framerate for smooth animation (15fps)
    const cmd = `ffmpeg -framerate 15 -i "${path.join(tempDir, 'frame_%03d.png')}" -vcodec libwebp -filter_complex "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0.0" -loop 0 -an -vsync 0 "${outputWebp}"`;
    
    console.log(`Running FFmpeg: ${cmd}`);
    
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.error('FFmpeg error:', err);
                return reject(err);
            }
            
            console.log('FFmpeg compiled successfully!');
            const webpBuffer = fs.readFileSync(outputWebp);
            
            // Clean up temp files
            try {
                for (const fp of framePaths) {
                    fs.unlinkSync(fp);
                }
                fs.unlinkSync(outputWebp);
                fs.rmdirSync(tempDir);
                console.log('Temporary files cleaned up.');
            } catch (cleanupErr) {
                console.warn('Cleanup warning:', cleanupErr);
            }
            
            resolve(webpBuffer);
        });
    });
}

async function test() {
    try {
        console.log('Starting local ATTP generation test...');
        const buffer = await generateLocalAttp('Halo Dunia 🌟');
        console.log(`SUCCESS! Generated WebP size: ${buffer.length} bytes`);
        
        // Write to a test file in scratch
        fs.writeFileSync('scratch/test_attp_output.webp', buffer);
        console.log('Result saved to scratch/test_attp_output.webp');
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
