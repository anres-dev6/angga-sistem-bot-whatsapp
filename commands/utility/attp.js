import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { exec } from 'child_process';
import { tmpdir } from 'os';
import { addStickerMetadata } from '../../Lib/sticker.js';

// Word-wrapping helper for optimal layout
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
    return lines.slice(0, 5); // Limit to maximum 5 lines
}

export default {
    name: 'attp',
    aliases: ['attp'],
    tags: ['sticker'],
    description: 'Mengubah teks menjadi stiker animasi pelangi yang menawan',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const text = args.join(" ");

        if (!text) {
            return sock.sendMessage(from, {
                text: "❌ Silakan masukkan teks yang ingin diubah menjadi stiker animasi.\n\n💡 *Contoh:* \n• *.attp Halo Dunia*\n• *.attp ANRES-DEV6*"
            }, { quoted: msg });
        }

        // Apply strict constraint for high-quality readable sticker output
        if (text.length > 40) {
            return sock.sendMessage(from, {
                text: "❌ Teks terlalu panjang! Batasi maksimal 40 karakter agar hasil tetap terbaca dengan jelas."
            }, { quoted: msg });
        }

        try {
            // Send processing reaction
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const totalFrames = 15;
            const tempDir = path.join(tmpdir(), `attp-${Date.now()}-${Math.random().toString(36).substring(7)}`);
            fs.mkdirSync(tempDir);

            // Wrap text into clean centered lines
            const lines = wrapText(text, 10);
            const maxLineLen = Math.max(...lines.map(l => l.length));

            // Dynamic font sizing & vertical spacing
            let fontSize = 75;
            if (maxLineLen > 5) fontSize = Math.floor(450 / (maxLineLen * 0.8));
            if (lines.length > 2) fontSize = Math.min(fontSize, Math.floor(250 / lines.length));
            if (fontSize < 24) fontSize = 24;
            if (fontSize > 85) fontSize = 85;

            const lineHeight = fontSize * 1.15;
            const totalHeight = (lines.length - 1) * lineHeight;
            const startY = 256 - totalHeight / 2;

            const framePaths = [];
            for (let i = 0; i < totalFrames; i++) {
                // Hue transition (0-360 degrees) across the frames
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
                    // Escape XML characters to prevent SVG parsing failures
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
                                font-family: 'Impact', 'Arial Black', 'Arial', 'Liberation Sans', 'DejaVu Sans', sans-serif;
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
            
            // Build animated WebP using FFmpeg with optimal aspect ratios and transparent backgrounds
            const cmd = `ffmpeg -framerate 15 -i "${path.join(tempDir, 'frame_%03d.png')}" -vcodec libwebp -filter_complex "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0.0" -loop 0 -an -vsync 0 "${outputWebp}"`;

            await new Promise((resolve, reject) => {
                exec(cmd, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            // Read the completed WebP file
            const rawWebp = fs.readFileSync(outputWebp);

            // Safe cleanup of temporary folder & files
            for (const fp of framePaths) {
                try { fs.unlinkSync(fp); } catch {}
            }
            try { fs.unlinkSync(outputWebp); } catch {}
            try { fs.rmdirSync(tempDir); } catch {}

            // Inject custom sticker EXIF metadata
            const finalSticker = await addStickerMetadata(rawWebp, 'ANRES-DEV6', 'Made With ANRES');

            // Send stiker & positive reaction
            await sock.sendMessage(from, { sticker: finalSticker }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[ATTP Command] Error:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: `❌ Gagal memproses stiker animasi: ${error.message}`
            }, { quoted: msg });
        }
    }
};
