import { downloadSubtitle } from '../../utils/ytdlp.js';
import fs from 'fs';
import path from 'path';

export default {
    name: 'sub',
    aliases: ['sub', 'subtitle', 'cc'],
    tags: ['tools'],
    description: 'Download subtitle dari video',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            const url = args[0];
            const lang = args[1] || 'en'; // Default English

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.sub https://youtu.be/xxx\n.sub https://youtu.be/xxx id\n.sub https://youtu.be/xxx en"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: `⏳ *Mendownload subtitle (${lang})...*`
            }, { quoted: msg });

            const outputPath = path.join(process.cwd(), 'temp', `sub_${Date.now()}`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const subtitlePath = await downloadSubtitle(url, lang, outputPath);

            if (!subtitlePath || !fs.existsSync(subtitlePath)) {
                return sock.sendMessage(from, {
                    text: `❌ Subtitle (${lang}) tidak ditemukan!\n\n💡 Coba bahasa lain:\n• en (English)\n• id (Indonesian)\n• auto (Auto-generated)`,
                    edit: progressMsg.key
                });
            }

            const subtitleContent = fs.readFileSync(subtitlePath, 'utf-8');
            const preview = subtitleContent.substring(0, 500);

            await sock.sendMessage(from, {
                document: fs.readFileSync(subtitlePath),
                fileName: `subtitle_${lang}.srt`,
                mimetype: 'application/x-subrip',
                caption: `📜 *Subtitle (${lang})*\n\nPreview:\n${preview}...`
            });

            fs.unlinkSync(subtitlePath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[Sub] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download subtitle!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
