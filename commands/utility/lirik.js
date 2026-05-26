import axios from 'axios';

export default {
    name: 'lirik',
    aliases: ['lirik', 'lyrics', 'lagu'],
    tags: ['tools'],
    description: 'Cari lirik lagu',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            const query = args.join(' ');

            if (!query) {
                return sock.sendMessage(from, {
                    text: '❌ Masukan judul lagu!\n\n💡 Contoh:\n.lirik kangen\n.lyrics faded'
                }, { quoted: msg });
            }

            // React with loading
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            console.log('[Lirik] Searching:', query);

            const url = `https://zelapioffciall.koyeb.app/search/lirik?q=${encodeURIComponent(query)}`;
            const { data } = await axios.get(url, { timeout: 20000 });

            if (!data.status || !data.result) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, {
                    text: '❌ Lirik tidak ditemukan!\n\n💡 Coba kata kunci yang lebih spesifik.'
                }, { quoted: msg });
            }

            const { artist, track, album, lyrics } = data.result;

            const caption = `🎵 *LIRIK LAGU* 🎵\n\n` +
                `📌 ${track}\n` +
                `👤 ${artist}\n` +
                `💽 ${album}\n` +
                `\n━━━━━━━━━━━━━━━\n\n` +
                `${lyrics}`;

            await sock.sendMessage(from, {
                text: caption
            }, { quoted: msg });

            // React with success
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error('[Lirik] Error:', e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: '❌ Terjadi kesalahan saat mencari lirik.\n\n💡 Coba lagi nanti.'
            }, { quoted: msg });
        }
    }
};
