import { downloadContentFromMessage } from 'baileys';
import { addStickerMetadata } from '../../Lib/sticker.js';
import { validateFonts } from '../../utils/fontHelper.js';
import fs from 'fs';
import path from 'path';
import https from 'https';

// Emoji Split Regex and length logic
const emojiRegex = /(\p{Emoji_Presentation}+(?:\u{200D}\p{Emoji_Presentation}+)*|[\u{1F1E6}-\u{1F1FF}]{2}|\p{Emoji}\uFE0F)/gu;

function getVisualLength(text) {
    if (!text) return 0;
    return text.replace(emojiRegex, 'X').length;
}

function wrapText(text, maxCharsPerLine = 13) {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        const currentLineLen = getVisualLength(currentLine);
        const wordLen = getVisualLength(word);
        if ((currentLineLen + (currentLine ? 1 : 0) + wordLen) <= maxCharsPerLine) {
            currentLine = currentLine ? currentLine + ' ' + word : word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3); // Limit to maximum 3 lines per block to preserve focal object
}

// Downloader helper
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

function getEmojiCodePoint(emoji) {
    const codePoints = [];
    for (let i = 0; i < emoji.length; i++) {
        const code = emoji.codePointAt(i);
        if (code > 0xffff) {
            i++;
        }
        codePoints.push(code.toString(16).toLowerCase());
    }
    return codePoints.filter(cp => cp !== 'fe0f').join('-');
}

async function getEmojiDataUri(emoji) {
    try {
        const cp = getEmojiCodePoint(emoji);
        const emojiDir = path.resolve('./assets/emojis');
        if (!fs.existsSync(emojiDir)) {
            fs.mkdirSync(emojiDir, { recursive: true });
        }
        const localPath = path.join(emojiDir, `${cp}.svg`);

        if (!fs.existsSync(localPath)) {
            const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${cp}.svg`;
            // 3-second timeout for downloading
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Timeout')), 3000);
                downloadFile(url, localPath).then(() => {
                    clearTimeout(timer);
                    resolve();
                }).catch(err => {
                    clearTimeout(timer);
                    reject(err);
                });
            });
        }

        const svgContent = fs.readFileSync(localPath, 'utf8');
        const base64 = Buffer.from(svgContent).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
    } catch (err) {
        console.error(`[Emoji Cache] Failed for ${emoji}:`, err.message);
        return null;
    }
}

async function measureTextWidth(text, fontSize, fontName) {
    const trimmed = text.trim();
    if (!trimmed) {
        return text.length * fontSize * 0.25; // Space width estimation
    }

    const escaped = trimmed
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const svg = `
    <svg width="2000" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="none" />
        <text x="10" y="100" font-family="${fontName}" font-weight="900" font-size="${fontSize}" fill="#ffffff" text-anchor="start" dy="0.35em">${escaped}</text>
    </svg>
    `;

    try {
        const { info } = await sharp(Buffer.from(svg))
            .trim()
            .toBuffer({ resolveWithObject: true });
        
        const spacesCount = text.length - trimmed.length;
        return info.width + spacesCount * fontSize * 0.25;
    } catch (err) {
        // Fallback estimation
        return text.length * fontSize * 0.45;
    }
}

async function renderLine(lineText, fontSize, y, fontName) {
    const parts = lineText.split(emojiRegex);
    const widths = [];
    const emojiUris = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i % 2 === 0) {
            const w = await measureTextWidth(part, fontSize, fontName);
            widths.push(w);
            emojiUris.push(null);
        } else {
            widths.push(fontSize * 1.05); // Width allocated for emoji
            const dataUri = await getEmojiDataUri(part);
            emojiUris.push(dataUri);
        }
    }

    const totalWidth = widths.reduce((sum, w) => sum + w, 0);
    let currentX = 256 - totalWidth / 2;
    let svgContent = '';
    const strokeWidth = Math.max(3.5, fontSize * 0.11);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const width = widths[i];

        if (i % 2 === 0) {
            if (part) {
                const escaped = part
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
                
                svgContent += `<text x="${currentX}" y="${y}" font-family="${fontName}" font-weight="900" font-size="${fontSize}" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" text-anchor="start" dy="0.35em" style="font-size: ${fontSize}px; stroke-width: ${strokeWidth}px; font-family: ${fontName}; font-weight: 900;">${escaped}</text>\n`;
            }
        } else {
            const dataUri = emojiUris[i];
            if (dataUri) {
                const emojiY = y - fontSize / 2;
                const emojiX = currentX + (width - fontSize) / 2;
                svgContent += `<image x="${emojiX}" y="${emojiY}" width="${fontSize}" height="${fontSize}" href="${dataUri}" />\n`;
            }
        }
        currentX += width;
    }

    return svgContent;
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
        let sharp;
        try {
            sharp = (await import('sharp')).default;
        } catch (e) {
            throw new Error("Modul 'sharp' tidak dapat dimuat pada perangkat ini. Silakan hubungi administrator.");
        }
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
        if (getVisualLength(topText) > 50 || getVisualLength(bottomText) > 50) {
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

            // 2. Perform font validation before rendering
            const { isAntonValid, isNotoValid } = validateFonts();
            
            // Construct fallback font stack dynamically
            let fontStack = [];
            if (isAntonValid) fontStack.push("Anton");
            if (isNotoValid) fontStack.push("'Noto Sans'");
            fontStack.push("'Arial Black'", "Arial", "sans-serif");
            const fontName = fontStack.join(", ");

            // 3. Calculate optimized font sizing based on length & number of lines
            const getFontSize = (lines) => {
                if (lines.length === 0) return 0;
                const maxLen = Math.max(...lines.map(l => getVisualLength(l)));
                // Proportional base size (each letter of narrow bold fonts is approx 0.45 - 0.50 of font size in width)
                let size = Math.floor(400 / (maxLen * 0.5));
                
                // Dynamic caps depending on the number of wrapped lines to prevent canvas overflow
                let maxCap = 80; // 1 Line can be up to 80px (dikecilkan dari 100)
                if (lines.length === 2) maxCap = 60; // 2 Lines capped at 60px (dikecilkan dari 75)
                if (lines.length === 3) maxCap = 45; // 3 Lines capped at 45px (dikecilkan dari 55)
                
                let minCap = 28;
                if (lines.length === 1) minCap = 40; // Single line minCap (dikecilkan dari 50)
                
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
                for (let idx = 0; idx < topLines.length; idx++) {
                    const line = topLines[idx];
                    const y = 25 + idx * topLineHeight + topLineHeight / 2;
                    textOverlaySvg += await renderLine(line, topFontSize, y, fontName);
                }
            }

            // Render bottom text lines inline (stacked upwards from the safe bottom margin)
            if (bottomLines.length > 0) {
                const bottomLineHeight = bottomFontSize * 1.1;
                const totalHeight = bottomLines.length * bottomLineHeight;
                const startY = 490 - totalHeight;

                for (let idx = 0; idx < bottomLines.length; idx++) {
                    const line = bottomLines[idx];
                    const y = startY + idx * bottomLineHeight + bottomLineHeight / 2;
                    textOverlaySvg += await renderLine(line, bottomFontSize, y, fontName);
                }
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
                    fit: 'cover'
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

