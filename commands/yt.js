import { getVideoInfo, formatDuration } from '../utils/ytdlp.js';
import { sendUniversalQualityList } from '../utils/interactiveMessage.js';

export default {
    name: 'yt',
    aliases: ['yt', 'youtube', 'ytdl'],
    tags: ['download'],
    description: 'Download YouTube video dengan pilihan kualitas',
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
                text: "⏳ *Mengambil info video...*"
            }, { quoted: msg });

            console.log('[YouTube] Getting video info:', url);

            // Get video info
            const info = await getVideoInfo(url);

            // Create session with yt-dlp engine
            const { createSession } = await import('../utils/sessionManager.js');
            createSession(from, {
                engine: 'yt-dlp',
                stage: 'select_quality',
                url: url,
                qualities: {
                    video: [144, 240, 360, 480, 720, 1080],
                    audio: []
                },
                platform: 'youtube',
                title: info.title
            });

            // Use pagination system
            const qualities = {
                video: [144, 240, 360, 480, 720, 1080],
                audio: []
            };

            await sendUniversalQualityList(
                sock,
                from,
                info.title,
                'youtube',
                qualities,
                url,
                0 // Start at page 0
            );

            // Delete progress message
            await sock.sendMessage(from, {
                delete: progressMsg.key
            });

        } catch (err) {
            console.error('[YouTube] Error:', err);

            let errorMsg = '❌ *Gagal mengambil info video!*\n\n';

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
