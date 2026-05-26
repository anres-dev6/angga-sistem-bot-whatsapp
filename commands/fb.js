import { downloadMedia } from '../Lib/downloader.js';
import fs from 'fs';

export default {
    name: 'fb',
    aliases: ['fb', 'facebook', 'fbdl'],
    tags: ['download'],
    description: 'Download Facebook video',
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
                    text: "❌ Masukin link Facebook!\n\n💡 Contoh:\n.fb https://www.facebook.com/xxxxx\n.fb https://fb.watch/xxxxx"
                }, { quoted: msg });
            }

            if (!url.includes('facebook.com') && !url.includes('fb.watch') && !url.includes('fb.com')) {
                return sock.sendMessage(from, {
                    text: "❌ Link bukan dari Facebook!\n\n💡 Pastikan link dari Facebook."
                }, { quoted: msg });
            }

            progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Memproses Facebook...*"
            }, { quoted: msg });

            console.log('[Facebook] Downloading:', url);

            await sock.sendMessage(from, {
                text: "⬇️ *Mendownload video...*\n\n_Mohon tunggu, proses mungkin memakan waktu..._",
                edit: progressMsg.key
            });

            // Download using yt-dlp
            const result = await downloadMedia(url, (percent) => {
                if (percent % 25 === 0) {
                    console.log(`[Facebook] Progress: ${percent}%`);
                }
            });

            filePath = result.filePath;

            await sock.sendMessage(from, {
                text: "📤 *Mengirim video...*",
                edit: progressMsg.key
            });

            const caption = `📘 *Facebook Downloader*\n\n` +
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
            console.error('[Facebook] Error:', err.message);

            // Cleanup on error
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch { }
            }

            let errorMsg = '❌ *Gagal download Facebook!*\n\n';

            if (err.message.includes('terlalu besar')) {
                errorMsg += err.message;
            } else if (err.message.includes('private')) {
                errorMsg += '🔒 Video private atau hanya untuk teman.';
            } else if (err.message.includes('tidak tersedia')) {
                errorMsg += '🚫 Video tidak tersedia.';
            } else if (err.message.includes('memerlukan login')) {
                errorMsg += '🔐 Video memerlukan login.';
            } else if (err.message.includes('yt-dlp.exe tidak ditemukan')) {
                errorMsg += '⚠️ yt-dlp tidak ditemukan.\n💡 Pastikan yt-dlp.exe ada di folder Lib.';
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
