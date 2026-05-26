import { getAvailableFormats, downloadVideo } from '../utils/ytdlp.js';
import fs from 'fs';
import path from 'path';

export default {
    name: 'ytv',
    aliases: ['ytv', 'ytvideo'],
    tags: ['download'],
    description: 'Download YouTube video only (no audio)',
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
                    text: "❌ Masukin link YouTube!\n\n💡 Contoh:\n.ytv https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                return sock.sendMessage(from, {
                    text: "❌ Link bukan dari YouTube!"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mendownload video...*"
            }, { quoted: msg });

            const formats = await getAvailableFormats(url);

            // Get best video format (no audio)
            const bestVideo = formats.video[0]; // Highest quality

            const outputPath = path.join(process.cwd(), 'temp', `ytv_${Date.now()}.mp4`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            await downloadVideo(url, bestVideo.format_id, outputPath);

            const stats = fs.statSync(outputPath);
            const fileSizeMB = stats.size / (1024 * 1024);

            if (fileSizeMB > 100) {
                fs.unlinkSync(outputPath);
                return sock.sendMessage(from, {
                    text: '❌ File terlalu besar (>100MB)!',
                    edit: progressMsg.key
                });
            }

            await sock.sendMessage(from, {
                video: fs.readFileSync(outputPath),
                caption: `🎬 *${formats.title}*\n\n📦 Size: ${fileSizeMB.toFixed(2)}MB\n📹 Video Only (No Audio)`,
                mimetype: 'video/mp4'
            });

            fs.unlinkSync(outputPath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[YTV] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
