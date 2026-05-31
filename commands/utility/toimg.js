import { downloadContentFromMessage } from 'baileys';
import sharp from 'sharp';

export default {
    name: 'toimg',
    aliases: ['toimg', 'toimage', 'togambar'],
    tags: ['sticker'],
    description: 'Mengubah stiker WhatsApp menjadi gambar format PNG berkualitas tinggi',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Check if there is a sticker (direct or quoted reply)
        const stickerMessage = msg.message?.stickerMessage || q?.stickerMessage;

        if (!stickerMessage) {
            return sock.sendMessage(from, { 
                text: '❌ Silakan reply stiker yang ingin diubah menjadi gambar dengan mengetik *.toimg*' 
            }, { quoted: msg });
        }

        // Animated stickers are not supported for simple static image conversion
        if (stickerMessage.isAnimated) {
            return sock.sendMessage(from, { 
                text: '❌ Maaf, stiker bergerak (animated sticker) tidak didukung oleh fitur ini.' 
            }, { quoted: msg });
        }

        try {
            // Send processing reaction
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // Download sticker content
            const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Convert WebP sticker to high-quality PNG (transparency is preserved)
            const pngBuffer = await sharp(buffer)
                .png({ quality: 100, compressionLevel: 9 })
                .toBuffer();

            // Send PNG image back to the user
            await sock.sendMessage(from, { 
                image: pngBuffer, 
                caption: '✨ *Stiker berhasil dikonversi ke gambar (PNG)!*' 
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[ToImg Command] Error:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, { 
                text: `❌ Gagal mengonversi stiker ke gambar: ${error.message}` 
            }, { quoted: msg });
        }
    }
};
