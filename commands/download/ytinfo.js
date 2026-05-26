import { getVideoInfo, formatDuration, formatFileSize } from '../../utils/ytdlp.js';

export default {
    name: 'ytinfo',
    aliases: ['ytinfo', 'yti'],
    tags: ['tools'],
    description: 'Lihat info video YouTube',
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
                    text: "❌ Masukin link YouTube!\n\n💡 Contoh:\n.ytinfo https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mengambil info...*"
            }, { quoted: msg });

            const info = await getVideoInfo(url);

            const infoText = `📹 *VIDEO INFO*\n\n` +
                `📝 *Judul:* ${info.title}\n` +
                `👤 *Channel:* ${info.uploader}\n` +
                `⏱️ *Durasi:* ${formatDuration(info.duration)}\n` +
                `👁️ *Views:* ${formatNumber(info.view_count)}\n` +
                `👍 *Likes:* ${formatNumber(info.like_count)}\n` +
                `📅 *Upload:* ${new Date(info.upload_date).toLocaleDateString('id-ID')}\n` +
                `🔗 *URL:* ${info.webpage_url}`;

            await sock.sendMessage(from, {
                text: infoText,
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[YTInfo] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal mengambil info!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};

function formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
