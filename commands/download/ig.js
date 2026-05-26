import { downloadMedia } from '../../Lib/downloader.js';
import fs from 'fs';

export default {
    name: 'ig',
    aliases: ['ig', 'instagram', 'igdl', 'reels'],
    tags: ['download'],
    description: 'Download Instagram video/photo/reels',
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
                    text: "❌ Masukin link Instagram!\n\n💡 Contoh:\n.ig https://www.instagram.com/p/xxxxx\n.ig https://www.instagram.com/reel/xxxxx"
                }, { quoted: msg });
            }

            if (!url.includes('instagram.com')) {
                return sock.sendMessage(from, {
                    text: "❌ Link bukan dari Instagram!\n\n💡 Pastikan link dari Instagram."
                }, { quoted: msg });
            }

            progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Memproses Instagram...*"
            }, { quoted: msg });

            console.log('[Instagram] Downloading:', url);

            await sock.sendMessage(from, {
                text: "⬇️ *Mendownload media...*\n\n_Mohon tunggu, proses mungkin memakan waktu..._",
                edit: progressMsg.key
            });

            // Download using yt-dlp
            const result = await downloadMedia(url, (percent) => {
                if (percent % 25 === 0) {
                    console.log(`[Instagram] Progress: ${percent}%`);
                }
            });

            filePath = result.filePath;

            await sock.sendMessage(from, {
                text: "📤 *Mengirim media...*",
                edit: progressMsg.key
            });

            const caption = `📸 *Instagram Downloader*\n\n` +
                `📦 ${result.size}MB\n\n` +
                `✅ Downloaded berhasil`;

            // Detect if video or image
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
            console.error('[Instagram] Error:', err.message);

            // Cleanup on error
            if (filePath && fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch { }
            }

            let errorMsg = '❌ *Gagal download Instagram!*\n\n';

            if (err.message.includes('terlalu besar')) {
                errorMsg += err.message;
            } else if (err.message.includes('private')) {
                errorMsg += '🔒 Post/Reels private.';
            } else if (err.message.includes('tidak tersedia')) {
                errorMsg += '🚫 Post/Reels tidak tersedia.';
            } else if (err.message.includes('memerlukan login')) {
                errorMsg += '🔐 Post memerlukan login.';
            } else if (err.message.includes('yt-dlp.exe tidak ditemukan')) {
                errorMsg += '⚠️ yt-dlp tidak ditemukan.\n💡 Pastikan yt-dlp.exe ada di folder bot.';
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
