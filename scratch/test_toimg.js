import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { imageToWebp } from '../Lib/converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
    console.log('Running ToImg (WebP to PNG) Conversion Tests...');

    // 1. Create a dummy transparent 1x1 PNG pixel base64
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const pngBuffer = Buffer.from(base64Png, 'base64');

    console.log('   Converting dummy PNG to WebP sticker first...');
    const webpBuffer = await imageToWebp(pngBuffer);

    // 2. Convert WebP back to PNG (simulate .toimg)
    console.log('   Simulating .toimg: Converting WebP back to PNG...');
    const outputPngBuffer = await sharp(webpBuffer)
        .png({ quality: 100 })
        .toBuffer();

    console.log('   PNG conversion completed. Size:', outputPngBuffer.length, 'bytes');

    // 3. Inspect metadata of generated PNG to verify transparency (alpha channel exists)
    const metadata = await sharp(outputPngBuffer).metadata();
    console.log('\n--- CONVERSION METADATA ---');
    console.log('Format:', metadata.format); // Should be 'png'
    console.log('Channels:', metadata.channels); // Should be 4 (RGBA) if transparency is preserved
    console.log('Has Alpha Channel:', metadata.hasAlpha ? '✅ YES' : '❌ NO');
    console.log('---------------------------\n');

    if (metadata.format === 'png' && metadata.hasAlpha) {
        console.log('🎉 ALL TOIMG CONVERSION TESTS PASSED SUCCESSFULLY!');
    } else {
        throw new Error('❌ TOIMG CONVERSION TEST FAILED!');
    }
}

runTests().catch(console.error);
