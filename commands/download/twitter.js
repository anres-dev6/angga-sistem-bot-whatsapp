import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

export default {
    name: 'twitter',
    aliases: ['twitter', 'tw', 'x', 'xdl'],
    tags: ['download'],
    description: 'Download Twitter/X video',
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
                    text: "❌ Masukin link Twitter/X!\n\n💡 Contoh:\n.tw https://x.com/xxxxx/status/xxxxx"
                }, { quoted: msg });
            }

            if (!url.includes('twitter.com') && !url.includes('x.com')) {
                return sock.sendMessage(from, {
                    text: "❌ Link bukan dari Twitter/X!\n\n💡 Pastikan link dari Twitter atau X."
                }, { quoted: msg });
            }

            progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Memproses Twitter/X...*"
            }, { quoted: msg });

            console.log('[Twitter] Downloading:', url);

            await sock.sendMessage(from, {
                text: "⬇️ *Mendownload video...*\n\n_Mohon tunggu..._",
                edit: progressMsg.key
            });

            // Download using yt-dlp
            const result = await downloadMedia(url, (percent) => {
                if (percent % 25 === 0) {
                    console.log(`[Twitter] Progress: ${percent}%`);
                }
            });

            filePath = result.filePath;

            await sock.sendMessage(from, {
                text: "📤 *Mengirim video...*",
                edit: progressMsg.key
            });

            const caption = `🐦 *Twitter/X Downloader*\n\n` +
                `📦 ${result.size}MB\n\n` +
                `✅ Downloaded berhasil`;

            // Detect if video (most likely) or image
            const isVideo = filePath.endsWith('.mp4') || filePath.endsWith('.mkv') || filePath.endsWith('.webm');

            if (isVideo) {
                await sock.sendMessage(from, {
                    video: fs.readFileSync(filePath),
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    image: fs.readFileSync(filePath),
                    caption: caption
                }, { quoted: msg });
            }

            // Cleanup
            fs.unlinkSync(filePath);
            filePath = null;

            await sock.sendMessage(from, {
                text: "✅ *Selesai!*",
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[Twitter] Error:', err.message);

            // Cleanup on error
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch { }
            }

            let errorMsg = '❌ *Gagal download Twitter!*\n\n';

            if (err.message.includes('terlalu besar')) {
                errorMsg += err.message;
            } else if (err.message.includes('private')) {
                errorMsg += '🔒 Tweet private atau akun terkunci.';
            } else if (err.message.includes('tidak tersedia')) {
                errorMsg += '🚫 Tweet tidak tersedia / dihapus.';
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
