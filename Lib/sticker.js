import webpmux from 'node-webpmux';
const { Image } = webpmux;

/**
 * Create custom EXIF metadata buffer for WhatsApp stickers
 * @param {string} packName - Sticker pack name
 * @param {string} authorName - Sticker author
 * @returns {Buffer} EXIF Buffer
 */
export function createExifBuffer(packName, authorName) {
    const json = {
        'sticker-pack-id': 'ANRES-DEV6-BOT',
        'sticker-pack-name': packName,
        'sticker-pack-publisher': authorName,
        'emojis': ['🎨', '🤖']
    };

    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
    const jsonLength = jsonBuffer.length;

    const exifHeader = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00,
        0x00, 0x00, 0x00, 0x00, // length of JSON (will write below)
        0x16, 0x00, 0x00, 0x00  // offset to JSON (22)
    ]);

    // Write length of JSON at offset 14 (32-bit little-endian)
    exifHeader.writeUInt32LE(jsonLength, 14);

    return Buffer.concat([exifHeader, jsonBuffer]);
}

/**
 * Add custom WhatsApp sticker metadata to WebP buffer
 * @param {Buffer} webpBuffer - Raw WebP image buffer
 * @param {string} packName - Sticker pack name
 * @param {string} authorName - Sticker author
 * @returns {Promise<Buffer>} WebP buffer with metadata
 */
export async function addStickerMetadata(webpBuffer, packName = 'ANRES-DEV6', authorName = 'Made With ANRES') {
    try {
        const img = new Image();
        await img.load(webpBuffer);
        
        const exifBuffer = createExifBuffer(packName, authorName);
        img.exif = exifBuffer;
        
        return await img.save(null);
    } catch (e) {
        console.error('[Sticker Metadata] Failed to inject EXIF metadata:', e);
        return webpBuffer; // Fallback to raw buffer on failure
    }
}
