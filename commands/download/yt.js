import { getVideoInfo, formatDuration, downloadYTDLP } from '../../utils/ytdlp.js';
import fs from 'fs';

export default {
    name: 'yt',
    aliases: ['yt', 'youtube', 'ytdl'],
    tags: ['download'],
    description: 'Download YouTube video (Max 720p)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        let progressMsg;

        try {
            const url = args[0];

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link YouTube!\n\n💡 Contoh:\n.yt https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                return sock.sendMessage(from, {
                    text: "❌ Link bukan dari YouTube!\n\n💡 Pastikan link dari YouTube."
                }, { quoted: msg });
            }

            progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mendownload video YouTube (Max 720p)...*"
            }, { quoted: msg });

            console.log('[YouTube] Downloading video:', url);

            // Get video info
            const info = await getVideoInfo(url);

            // Download using the 720p quality target (with audio)
            const result = await downloadYTDLP(url, '720');

            const stats = fs.statSync(result.filePath);
            const fileSizeMB = stats.size / (1024 * 1024);

            if (fileSizeMB > 100) {
                fs.unlinkSync(result.filePath);
                return sock.sendMessage(from, {
                    text: '❌ File terlalu besar (>100MB)!',
                    edit: progressMsg.key
                });
            }

            await sock.sendMessage(from, {
                text: '📤 *Mengirim video...*',
                edit: progressMsg.key
            });

            await sock.sendMessage(from, {
                video: fs.readFileSync(result.filePath),
                caption: `🎬 *${info.title}*\n\n👤 Uploader: ${info.uploader || 'Unknown'}\n⏱️ Durasi: ${formatDuration(info.duration)}\n📦 Size: ${fileSizeMB.toFixed(2)}MB`,
                mimetype: 'video/mp4'
            });

            fs.unlinkSync(result.filePath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[YouTube] Error:', err);

            let errorMsg = '❌ *Gagal mendownload video!*\n\n';

            if (err.message.includes('private')) {
                errorMsg += '🔒 Video private atau age-restricted.';
            } else if (err.message.includes('tidak tersedia')) {
                errorMsg += '🚫 Video tidak tersedia.';
            } else if (err.message.includes('geo')) {
                errorMsg += '🌍 Video tidak tersedia di region ini.';
            } else {
                errorMsg += `⚠️ ${err.message}`;
            }

            if (progressMsg && progressMsg.key) {
                await sock.sendMessage(from, { text: errorMsg, edit: progressMsg.key });
            } else {
                await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
            }
        }
    }
};
