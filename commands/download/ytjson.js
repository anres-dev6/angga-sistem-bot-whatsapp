import { getVideoInfo } from '../../utils/ytdlp.js';

export default {
    name: 'ytjson',
    aliases: ['ytjson', 'metadata'],
    tags: ['tools'],
    description: 'Export full video metadata as JSON',
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
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.ytjson https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mengambil metadata...*"
            }, { quoted: msg });

            const info = await getVideoInfo(url);

            // Create formatted JSON
            const metadata = {
                title: info.title,
                uploader: info.uploader,
                uploader_id: info.uploader_id,
                channel_id: info.channel_id,
                duration: info.duration,
                view_count: info.view_count,
                like_count: info.like_count,
                upload_date: info.upload_date,
                description: info.description,
                tags: info.tags,
                categories: info.categories,
                webpage_url: info.webpage_url,
                thumbnail: info.thumbnail,
                formats_count: info.formats?.length || 0,
                available_resolutions: [...new Set(info.formats?.map(f => f.height).filter(h => h))],
                available_codecs: [...new Set(info.formats?.map(f => f.vcodec).filter(c => c && c !== 'none'))],
                subtitles: Object.keys(info.subtitles || {}),
                automatic_captions: Object.keys(info.automatic_captions || {})
            };

            const jsonString = JSON.stringify(metadata, null, 2);

            // Send as document
            await sock.sendMessage(from, {
                document: Buffer.from(jsonString),
                fileName: `${info.title.substring(0, 50)}_metadata.json`,
                mimetype: 'application/json',
                caption: `📊 *VIDEO METADATA*\n\n` +
                    `📝 ${info.title}\n` +
                    `👤 ${info.uploader}\n` +
                    `👁️ ${formatNumber(info.view_count)} views\n` +
                    `📊 ${metadata.formats_count} formats available`
            });

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[YTJson] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal mengambil metadata!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};

function formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
