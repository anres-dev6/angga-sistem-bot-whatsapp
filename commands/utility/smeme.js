import { downloadContentFromMessage } from 'baileys';
import sharp from 'sharp';
import { addStickerMetadata } from '../../Lib/sticker.js';

// Word-wrapping helper for optimal layout in 1:1 square canvas
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
    return lines.slice(0, 3); // Limit to maximum 3 lines per block to preserve focal object
}

export default {
    name: 'smeme',
    aliases: ['smeme', 'sticker-meme', 'stikermeme'],
    tags: ['sticker'],
    description: 'Mengubah gambar/stiker menjadi stiker meme WhatsApp dengan teks atas/bawah secara otomatis',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // Unpack wrappers if present (handles View Once, Ephemeral, etc.)
        let targetMsg = q || msg.message;
        if (targetMsg?.ephemeralMessage?.message) {
            targetMsg = targetMsg.ephemeralMessage.message;
        }
        if (targetMsg?.viewOnceMessage?.message) {
            targetMsg = targetMsg.viewOnceMessage.message;
        } else if (targetMsg?.viewOnceMessageV2?.message) {
            targetMsg = targetMsg.viewOnceMessageV2.message;
        } else if (targetMsg?.viewOnceMessageV2Extension?.message) {
            targetMsg = targetMsg.viewOnceMessageV2Extension.message;
        }

        // Find image or sticker message
        const imageContent = targetMsg?.imageMessage;
        const stickerContent = targetMsg?.stickerMessage;

        if (!imageContent && !stickerContent) {
            return sock.sendMessage(from, {
                text: "❌ Kirim/Reply gambar atau stiker dengan caption *.smeme Teks Atas|Teks Bawah*\n\n💡 *Cara pakai:*\n• Reply gambar/stiker: `.smeme AKU|PAS DOSEN BILANG CUMA 1 SOAL`\n• Kirim gambar dengan caption: `.smeme AKU PAS LIAT NILAI`"
            }, { quoted: msg });
        }

        // Reject animated stickers since meme overlay requires a static canvas
        if (stickerContent && stickerContent.isAnimated) {
            return sock.sendMessage(from, {
                text: "❌ Maaf, stiker bergerak (animated sticker) tidak didukung untuk dijadikan stiker meme."
            }, { quoted: msg });
        }

        const input = args.join(" ");
        if (!input) {
            return sock.sendMessage(from, {
                text: "❌ Silakan masukkan teks meme untuk ditempelkan pada gambar/stiker.\n\n💡 *Format:* \n• `.smeme Teks Atas|Teks Bawah`\n• `.smeme Teks Atas`"
            }, { quoted: msg });
        }

        // Split text by "|" character
        let topText = '';
        let bottomText = '';
        if (input.includes('|')) {
            const parts = input.split('|');
            topText = parts[0]?.trim() || '';
            bottomText = parts[1]?.trim() || '';
        } else {
            topText = input.trim();
        }

        // Apply length constraints to preserve high quality readability
        if (topText.length > 50 || bottomText.length > 50) {
            return sock.sendMessage(from, {
                text: "❌ Teks terlalu panjang! Maksimal 50 karakter per baris agar stiker meme tetap terbaca dengan jelas."
            }, { quoted: msg });
        }

        try {
            // Send processing reaction
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // Download media content dynamically depending on type
            let buffer = Buffer.from([]);
            if (imageContent) {
                const stream = await downloadContentFromMessage(imageContent, 'image');
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
            } else if (stickerContent) {
                const stream = await downloadContentFromMessage(stickerContent, 'sticker');
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
            }

            // 1. Wrap text blocks into uppercase lines (wrap at 13 chars per line for massive Impact-style layouts)
            const top = topText.toUpperCase();
            const bottom = bottomText.toUpperCase();

            const topLines = wrapText(top, 13);
            const bottomLines = wrapText(bottom, 13);

            // 2. Calculate optimized font sizing based on length & number of lines
            const getFontSize = (lines) => {
                if (lines.length === 0) return 0;
                const maxLen = Math.max(...lines.map(l => l.length));
                // Proportional base size (each letter of narrow bold fonts is approx 0.45 - 0.50 of font size in width)
                let size = Math.floor(480 / (maxLen * 0.5));
                
                // Dynamic caps depending on the number of wrapped lines to prevent canvas overflow
                let maxCap = 100; // 1 Line can be HUGE (up to 100px)
                if (lines.length === 2) maxCap = 75; // 2 Lines capped at 75px
                if (lines.length === 3) maxCap = 55; // 3 Lines capped at 55px to protect focal object
                
                let minCap = 35;
                if (lines.length === 1) minCap = 50; // Single line should always be highly prominent
                
                if (size < minCap) size = minCap;
                if (size > maxCap) size = maxCap;
                return size;
            };

            const topFontSize = getFontSize(topLines);
            const bottomFontSize = getFontSize(bottomLines);

            let textOverlaySvg = '';

            // Render top text lines inline
            if (topLines.length > 0) {
                const topLineHeight = topFontSize * 1.1;
                topLines.forEach((line, idx) => {
                    const y = 25 + idx * topLineHeight + topLineHeight / 2;
                    const escaped = line
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&apos;');
                    
                    const strokeWidth = Math.max(3.5, topFontSize * 0.11);
                    // Bulletproof: unitless attributes AND inline CSS style mapping guarantees correct scaling on ALL systems
                    textOverlaySvg += `<text x="256" y="${y}" font-family="Anton, 'Arial Black', Impact, Arial, sans-serif" font-weight="900" font-size="${topFontSize}" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em" style="font-size: ${topFontSize}px; stroke-width: ${strokeWidth}px; font-family: Anton, 'Arial Black', Impact, Arial, sans-serif; font-weight: 900;">${escaped}</text>\n`;
                });
            }

            // Render bottom text lines inline (stacked upwards from the safe bottom margin)
            if (bottomLines.length > 0) {
                const bottomLineHeight = bottomFontSize * 1.1;
                const totalHeight = bottomLines.length * bottomLineHeight;
                const startY = 490 - totalHeight;

                bottomLines.forEach((line, idx) => {
                    const y = startY + idx * bottomLineHeight + bottomLineHeight / 2;
                    const escaped = line
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&apos;');

                    const strokeWidth = Math.max(3.5, bottomFontSize * 0.11);
                    // Bulletproof: unitless attributes AND inline CSS style mapping guarantees correct scaling on ALL systems
                    textOverlaySvg += `<text x="256" y="${y}" font-family="Anton, 'Arial Black', Impact, Arial, sans-serif" font-weight="900" font-size="${bottomFontSize}" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em" style="font-size: ${bottomFontSize}px; stroke-width: ${strokeWidth}px; font-family: Anton, 'Arial Black', Impact, Arial, sans-serif; font-weight: 900;">${escaped}</text>\n`;
                });
            }

            // Build transparent SVG overlay card (crucial: viewBox is required for perfect 1:1 scaling across different systems)
            const svgOverlay = `
            <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="none" />
                ${textOverlaySvg}
            </svg>
            `;

            // 3. Resize and composite the original image/sticker with SVG overlay in a single high-performance pipeline
            const rawWebpMeme = await sharp(buffer)
                .rotate() // Auto-orient phone photos based on EXIF
                .ensureAlpha() // Ensure alpha transparency exists
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 } // Add transparent border padding
                })
                .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
                .webp({ quality: 90 })
                .toBuffer();

            // 5. Inject WhatsApp custom sticker EXIF metadata (ANRES-DEV6 / Made With ANRES)
            const finalSticker = await addStickerMetadata(rawWebpMeme, 'ANRES-DEV6', 'Made With ANRES');

            // Send Meme Sticker
            await sock.sendMessage(from, { sticker: finalSticker }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[SMEME Command] Error:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: `❌ Gagal memproses stiker meme: ${error.message}`
            }, { quoted: msg });
        }
    }
};
