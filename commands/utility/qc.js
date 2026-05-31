import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';
import { addStickerMetadata } from '../../Lib/sticker.js';
import { db } from '../../Lib/database.js';

// Predefined modern, vibrant chat colors for different user names (similar to WhatsApp groups)
const colors = ['#25D366', '#34B7F1', '#F78154', '#FD5B78', '#FFD700', '#ADFF2F', '#FF69B4', '#00FFFF', '#FF7F50', '#DA70D6'];

const getJidColor = (jid) => {
    let hash = 0;
    for (let i = 0; i < jid.length; i++) {
        hash = jid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
};

// Word wrapping function for clean, uniform chat bubble boundaries
function wrapText(text, maxCharsPerLine = 22) {
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
    return lines.slice(0, 6); // Limit to maximum 6 lines for perfect 1:1 box fit
}

export default {
    name: 'qc',
    aliases: ['qc', 'quotly', 'quote'],
    tags: ['sticker'],
    description: 'Mengubah pesan menjadi stiker quote (Quotly) yang menawan secara lokal',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const q = msg.message?.extendedTextMessage?.contextInfo;
        
        let textToQuote = '';
        let senderJid = '';
        let senderName = '';

        // Case 1: Quoting a replied/quoted message
        if (q && q.quotedMessage) {
            const quotedMsg = q.quotedMessage;
            
            // Extract text from the replied message
            textToQuote = quotedMsg.conversation || 
                          quotedMsg.extendedTextMessage?.text || 
                          quotedMsg.imageMessage?.caption || 
                          quotedMsg.videoMessage?.caption || 
                          "";

            if (!textToQuote) {
                if (quotedMsg.stickerMessage) textToQuote = "🎨 [Stiker]";
                else if (quotedMsg.imageMessage) textToQuote = "🖼️ [Gambar]";
                else if (quotedMsg.videoMessage) textToQuote = "📹 [Video]";
                else if (quotedMsg.audioMessage) textToQuote = "🎵 [Audio]";
                else if (quotedMsg.documentMessage) textToQuote = "📄 [Dokumen]";
                else textToQuote = "📝 [Pesan]";
            }

            senderJid = q.participant || q.remoteJid || from;
            
            // Identify sender's name
            const currentSender = msg.key.participant || msg.key.remoteJid || '';
            if (senderJid === currentSender) {
                senderName = msg.pushName || senderJid.split('@')[0];
            } else {
                // If it's another group member, we try to construct a formatted phone number
                const num = senderJid.split('@')[0];
                senderName = `+${num}`;
            }
        } 
        // Case 2: Quoting user's direct text argument
        else {
            textToQuote = args.join(" ");
            if (!textToQuote) {
                return sock.sendMessage(from, {
                    text: "❌ Silakan reply pesan yang ingin dijadikan quote dengan mengetik *.qc* atau ketik *.qc [teks]* secara langsung."
                }, { quoted: msg });
            }

            senderJid = msg.key.participant || msg.key.remoteJid || from;
            senderName = msg.pushName || senderJid.split('@')[0] || 'User';
        }

        try {
            // Send processing reaction
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // Fetch quoted user's profile photo
            let avatarBuffer = null;
            try {
                // Get standard profile image URL
                const avatarUrl = await sock.profilePictureUrl(senderJid, 'image').catch(() => null);
                if (avatarUrl) {
                    const res = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 3000 });
                    avatarBuffer = Buffer.from(res.data);
                }
            } catch (err) {
                console.log('[QC Avatar] Failed to fetch avatar:', err.message);
            }

            // Word wrap the text
            const lines = wrapText(textToQuote, 22);
            const bubbleBgColor = '#202c33'; // Classic dark theme WhatsApp message bubble color
            const nameColor = getJidColor(senderJid);
            
            const fontSize = 22;
            const lineHeight = fontSize * 1.28;
            
            // Auto layout dimensions
            const bubbleWidth = 350;
            const nameHeight = 30;
            const padding = 20;
            const textHeight = lines.length * lineHeight;
            
            const bubbleHeight = padding * 2 + nameHeight + textHeight;
            const bubbleY = 256 - bubbleHeight / 2;
            
            const nameY = bubbleY + padding + nameHeight / 2;
            const textStartY = bubbleY + padding + nameHeight + 10;

            // Generate clean SVG for the avatar (clipping image if fetched, fallback to initial if absent)
            let avatarSvg = '';
            if (avatarBuffer) {
                const base64Avatar = avatarBuffer.toString('base64');
                avatarSvg = `
                <defs>
                    <clipPath id="circleClip">
                        <circle cx="70" cy="256" r="40" />
                    </clipPath>
                </defs>
                <image href="data:image/jpeg;base64,${base64Avatar}" x="30" y="216" width="80" height="80" clip-path="url(#circleClip)" />
                `;
            } else {
                // Remove special symbols to get a clean initial letter
                const cleanInitial = senderName.replace(/[^\w\s]/g, '').trim();
                const initial = cleanInitial.charAt(0).toUpperCase() || senderName.charAt(0).toUpperCase() || 'U';
                const avatarColor = getJidColor(senderJid);
                avatarSvg = `
                <circle cx="70" cy="256" r="40" fill="${avatarColor}" />
                <text x="70" y="256" font-family="'Impact', 'Arial Black', sans-serif" font-size="40" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initial}</text>
                `;
            }

            // Construct SVG text lines
            let textLinesSvg = '';
            lines.forEach((line, idx) => {
                const y = textStartY + idx * lineHeight + lineHeight / 2;
                const escaped = line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
                textLinesSvg += `<text x="150" y="${y}" font-family="'Arial', 'Helvetica', sans-serif" font-size="${fontSize}" fill="#ffffff" text-anchor="start" dominant-baseline="central">${escaped}</text>\n`;
            });

            const escapedName = senderName
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

            const svg = `
            <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                        <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.4" />
                    </filter>
                </defs>
                
                <rect width="100%" height="100%" fill="none" />
                
                <!-- Quoted Sender Avatar -->
                ${avatarSvg}
                
                <!-- Quote Bubble with tail and Drop-Shadow -->
                <g filter="url(#shadow)">
                    <!-- Bubble Tail -->
                    <path d="M 125 246 L 113 256 L 125 266 Z" fill="${bubbleBgColor}" />
                    <!-- Bubble Rect -->
                    <rect x="125" y="${bubbleY}" width="${bubbleWidth}" height="${bubbleHeight}" rx="18" ry="18" fill="${bubbleBgColor}" />
                </g>
                
                <!-- Sender Name -->
                <text x="150" y="${nameY}" font-family="'Arial Black', 'Impact', sans-serif" font-weight="900" font-size="24" fill="${nameColor}" text-anchor="start" dominant-baseline="central">${escapedName}</text>
                
                <!-- Quoted Message Body -->
                ${textLinesSvg}
            </svg>
            `;

            // Render SVG string into raw transparent PNG buffer
            const pngBuffer = await sharp(Buffer.from(svg))
                .png()
                .toBuffer();

            // Convert raw PNG to optimal WebP sticker buffer
            const stickerBuff = await sharp(pngBuffer)
                .webp({ quality: 90 })
                .toBuffer();

            // Inject custom sticker EXIF metadata (ANRES-DEV6 / Made With ANRES)
            const finalSticker = await addStickerMetadata(stickerBuff, 'ANRES-DEV6', 'Made With ANRES');

            // Send Quote Sticker
            await sock.sendMessage(from, { sticker: finalSticker }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[QC Command] Error:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: `❌ Gagal memproses quote stiker: ${error.message}`
            }, { quoted: msg });
        }
    }
};
