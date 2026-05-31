import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { imageToWebp } from '../Lib/converter.js';
import { addStickerMetadata } from '../Lib/sticker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
    console.log('Running WhatsApp Sticker Metadata Injection Tests...');

    // Create a 10x10 dummy PNG buffer
    // A tiny transparent 1x1 PNG pixel base64
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const pngBuffer = Buffer.from(base64Png, 'base64');

    console.log('1. Converting dummy PNG to WebP...');
    const webpBuffer = await imageToWebp(pngBuffer);
    console.log('   WebP conversion successful. Size:', webpBuffer.length, 'bytes');

    console.log('2. Injecting EXIF sticker metadata...');
    const stickerBuffer = await addStickerMetadata(webpBuffer, 'ANRES-DEV6', 'Made With ANRES');
    console.log('   EXIF Injection completed. Size:', stickerBuffer.length, 'bytes');

    // 3. Assertions
    const fileContentStr = stickerBuffer.toString('utf-8');
    const hasPack = fileContentStr.includes('ANRES-DEV6');
    const hasAuthor = fileContentStr.includes('Made With ANRES');

    console.log('\n--- VERIFICATION RESULTS ---');
    console.log('Sticker contains "ANRES-DEV6":', hasPack ? '✅ YES' : '❌ NO');
    console.log('Sticker contains "Made With ANRES":', hasAuthor ? '✅ YES' : '❌ NO');
    console.log('----------------------------\n');

    if (hasPack && hasAuthor) {
        console.log('🎉 ALL STICKER METADATA TESTS PASSED SUCCESSFULLY!');
    } else {
        throw new Error('❌ STICKER METADATA TEST FAILED! Metadata not found in WebP buffer.');
    }
}

runTests().catch(console.error);
