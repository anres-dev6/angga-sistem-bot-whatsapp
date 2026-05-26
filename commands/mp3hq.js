import { downloadAudio } from '../utils/ytdlp.js';
import fs from 'fs';
import path from 'path';

export default {
    name: 'mp3hq',
    aliases: ['mp3hq', 'mp3high'],
    tags: ['download'],
    description: 'Download audio kualitas tinggi (320kbps)',
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
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.mp3hq https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mendownload audio HQ...*"
            }, { quoted: msg });

            const outputPath = path.join(process.cwd(), 'temp', `mp3hq_${Date.now()}.mp3`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Download with 320kbps quality
            await downloadAudio(url, '320', outputPath);

            await sock.sendMessage(from, {
                audio: fs.readFileSync(outputPath),
                mimetype: 'audio/mpeg',
                fileName: `audio_hq.mp3`
            });

            fs.unlinkSync(outputPath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[MP3HQ] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
