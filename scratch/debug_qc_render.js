import fs from 'fs';
import sharp from 'sharp';

async function test() {
    const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="blue" />
        <text x="256" y="256" font-family="Arial" font-size="40" fill="white" text-anchor="middle">HELLO WORLD</text>
    </svg>
    `;
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile('scratch/debug_text.png');
        
    console.log('debug_text.png written.');
}

test();
