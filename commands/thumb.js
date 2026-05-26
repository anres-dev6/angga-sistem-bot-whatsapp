import { downloadThumbnail } from '../utils/ytdlp.js';
import fs from 'fs';
import path from 'path';

export default {
    name: 'thumb',
    aliases: ['thumb', 'thumbnail'],
    tags: ['download'],
    description: 'Download thumbnail video',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            const url = args[0];

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.thumb https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mendownload thumbnail...*"
            }, { quoted: msg });

            const outputPath = path.join(process.cwd(), 'temp', `thumb_${Date.now()}`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const thumbPath = await downloadThumbnail(url, outputPath);

            if (!thumbPath || !fs.existsSync(thumbPath)) {
                return sock.sendMessage(from, {
                    text: '❌ Thumbnail tidak ditemukan!',
                    edit: progressMsg.key
                });
            }

            await sock.sendMessage(from, {
                image: fs.readFileSync(thumbPath),
                caption: '🖼️ Thumbnail'
            });

            fs.unlinkSync(thumbPath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[Thumb] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
