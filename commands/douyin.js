import { downloadMedia } from '../Lib/downloader.js';
import fs from 'fs';

export default {
    name: 'douyin',
    aliases: ['douyin', 'dy'],
    tags: ['download'],
    description: 'Download Douyin video (TikTok China)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        let progressMsg = null;
        let filePath = null;

        try {
            const url = args[0];

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link Douyin!\n\n💡 Contoh:\n.douyin https://www.douyin.com/xxxxx\n.dy https://v.douyin.com/xxxxx"
                }, { quoted: msg });
            }

            if (!url.includes('douyin.com')) {
                return sock.sendMessage(from, {
                    text: "❌ Link bukan dari Douyin!\n\n💡 Pastikan link dari Douyin (TikTok China).\nContoh: v.douyin.com atau www.douyin.com"
                }, { quoted: msg });
            }

            progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Memproses Douyin...*"
            }, { quoted: msg });

            console.log('[Douyin] Downloading:', url);

            await sock.sendMessage(from, {
                text: "⬇️ *Mendownload video...*\n\n_Mohon tunggu, proses mungkin memakan waktu..._",
                edit: progressMsg.key
            });

            // Download using yt-dlp
            const result = await downloadMedia(url, (percent) => {
                if (percent % 25 === 0) {
                    console.log(`[Douyin] Progress: ${percent}%`);
                }
            });

            filePath = result.filePath;

            await sock.sendMessage(from, {
                text: "📤 *Mengirim video...*",
                edit: progressMsg.key
            });

            const caption = `🎵 *Douyin Downloader*\n\n` +
                `📦 ${result.size}MB\n\n` +
                `✅ Downloaded berhasil`;

            await sock.sendMessage(from, {
                video: fs.readFileSync(filePath),
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            // Cleanup
            fs.unlinkSync(filePath);
            filePath = null;

            await sock.sendMessage(from, {
                text: "✅ *Selesai!*",
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[Douyin] Error:', err.message);

            // Cleanup on error
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch { }
            }

            let errorMsg = '❌ *Gagal download Douyin!*\n\n';

            if (err.message.includes('terlalu besar')) {
                errorMsg += err.message;
            } else if (err.message.includes('private')) {
                errorMsg += '🔒 Video private.';
            } else if (err.message.includes('tidak tersedia')) {
                errorMsg += '🚫 Video tidak tersedia.';
            } else if (err.message.includes('memerlukan login')) {
                errorMsg += '🔐 Video memerlukan login.';
            } else if (err.message.includes('yt-dlp.exe tidak ditemukan')) {
                errorMsg += '⚠️ yt-dlp tidak ditemukan.\n💡 Pastikan yt-dlp.exe ada di folder Lib.';
            } else if (err.message.includes('Platform tidak didukung')) {
                errorMsg += '⚠️ Douyin belum didukung yt-dlp.\n💡 Coba link lain atau platform lain.';
            } else {
                errorMsg += `⚠️ ${err.message}`;
            }

            if (progressMsg && progressMsg.key) {
                try {
                    await sock.sendMessage(from, { text: errorMsg, edit: progressMsg.key });
                } catch {
                    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
            }
        }
    }
};
