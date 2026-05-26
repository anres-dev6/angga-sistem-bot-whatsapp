import { downloadContentFromMessage } from "baileys";
import { imageToWebp, videoToWebp } from "../../Lib/converter.js";

export default {
    name: 's',
    aliases: ['s', 'stiker', 'sticker'],
    tags: ['sticker'],
    description: 'Buat stiker dari gambar/video',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const m = msg;

        const q = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Check for image or video (direct or quoted)
        const content = m.message?.imageMessage ||
            m.message?.videoMessage ||
            q?.imageMessage ||
            q?.videoMessage;

        if (!content) {
            return sock.sendMessage(from, {
                text: "❌ Kirim/Reply gambar atau video dengan caption .s\n\n💡 Cara pakai:\n• Kirim gambar → .s\n• Reply gambar → .s\n• Kirim video (max 10 detik) → .s"
            }, { quoted: m });
        }

        const mime = content.mimetype || "";
        const isVideo = mime.includes("video") || mime.includes("gif");

        try {
            // Send processing reaction
            await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

            // Using downloadContentFromMessage specifically
            const stream = await downloadContentFromMessage(
                content,
                isVideo ? 'video' : 'image'
            );

            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            let stickerBuff;
            if (isVideo) {
                // Additional check for seconds if available
                if (content.seconds > 10) {
                    await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
                    return sock.sendMessage(from, {
                        text: "❌ Video maksimal 10 detik!\n\n💡 Potong video dulu atau kirim yang lebih pendek."
                    }, { quoted: m });
                }
                stickerBuff = await videoToWebp(buffer);
            } else {
                stickerBuff = await imageToWebp(buffer);
            }

            await sock.sendMessage(from, { sticker: stickerBuff }, { quoted: m });
            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });

        } catch (e) {
            console.error("Error creating sticker:", e);
            await sock.sendMessage(from, { react: { text: '❌', key: m.key } });

            let errorMsg = `❌ Gagal membuat stiker: ${e.message}`;

            if (e.message.includes('FFmpeg')) {
                errorMsg += '\n\n💡 FFmpeg diperlukan untuk stiker video.\nGunakan gambar saja untuk sementara.';
            }

            sock.sendMessage(from, { text: errorMsg }, { quoted: m });
        }
    }
};