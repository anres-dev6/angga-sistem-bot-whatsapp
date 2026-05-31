import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Test aspect ratio transformation to 1:1 (512x512) with transparent padding
async function testAspectRatio() {
    console.log('--- Testing aspect ratio conversion to 1:1 square ---');
    
    // Create a 16:9 landscape image buffer (say 800x450)
    // We render a simple SVG and convert it to JPEG to strip alpha channel (simulate camera photo)
    const landscapeSvg = `
    <svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="red" />
        <circle cx="400" cy="225" r="100" fill="yellow" />
    </svg>
    `;
    
    const jpegBuffer = await sharp(Buffer.from(landscapeSvg))
        .jpeg()
        .toBuffer();
        
    console.log('Original image aspect ratio: 16:9 (800x450), Format: JPEG (No Alpha)');
    
    // Convert to WebP using our improved function
    const webpBuffer = await sharp(jpegBuffer)
        .rotate()
        .ensureAlpha()
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 85 })
        .toBuffer();
        
    // Read output metadata
    const metadata = await sharp(webpBuffer).metadata();
    console.log('Converted WebP Metadata:');
    console.log(`- Width: ${metadata.width}`);
    console.log(`- Height: ${metadata.height}`);
    console.log(`- Format: ${metadata.format}`);
    console.log(`- Has Alpha: ${metadata.hasAlpha}`);
    
    if (metadata.width === 512 && metadata.height === 512 && metadata.hasAlpha) {
        console.log('\n✅ ASPECT RATIO TEST PASSED! Converted successfully to exactly 1:1 with alpha transparency.');
    } else {
        console.log('\n❌ TEST FAILED!');
    }
}

testAspectRatio().catch(console.error);
