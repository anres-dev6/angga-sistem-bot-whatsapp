import { getAvailableFormats } from '../../utils/ytdlp.js';
import { createDownloadSession } from '../../utils/downloadState.js';
import { createQualityList, createVideoInfoMessage } from '../../utils/interactiveDownload.js';

export default {
    name: 'ytadv',
    aliases: ['ytadv', 'ytadvanced'],
    tags: ['download'],
    description: 'Download YouTube dengan pilihan advanced (codec, container, dll)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        try {
            const url = args[0];

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link YouTube!\n\n💡 Contoh:\n.ytadv https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
                return sock.sendMessage(from, {
                    text: "❌ Link bukan dari YouTube!"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mengambil info video...*"
            }, { quoted: msg });

            console.log('[YTAdv] Getting video info:', url);

            // Get all available formats
            const formats = await getAvailableFormats(url);

            if (!formats.video || formats.video.length === 0) {
                return sock.sendMessage(from, {
                    text: "❌ Tidak ada format video yang tersedia!",
                    edit: progressMsg.key
                });
            }

            // Create download session
            createDownloadSession(sender, url, formats);

            // Use pagination system for quality selection
            const { sendUniversalQualityList, detectAvailableQualities } = await import('../../utils/interactiveMessage.js');

            // Convert formats to quality list
            const qualities = {
                video: formats.video.map(f => f.height).filter((h, i, arr) => arr.indexOf(h) === i).sort((a, b) => a - b),
                audio: []
            };

            // Send interactive pagination
            await sendUniversalQualityList(
                sock,
                from,
                formats.info?.title || 'YouTube Video',
                'youtube',
                qualities,
                url,
                0 // Start at page 0
            );

            // React selesai pada pesan progress
            await sock.sendMessage(from, {
                react: { text: '😹', key: progressMsg.key }
            });

        } catch (err) {
            console.error('[YTAdv] Error:', err);

            let errorMsg = '❌ *Gagal mengambil info video!*\n\n';

            if (err.message.includes('private')) {
                errorMsg += '🔒 Video private atau age-restricted.';
            } else if (err.message.includes('tidak tersedia')) {
                errorMsg += '🚫 Video tidak tersedia.';
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
