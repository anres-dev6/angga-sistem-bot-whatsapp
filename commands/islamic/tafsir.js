import fetch from 'node-fetch';

export default {
    name: 'tafsir',
    aliases: ['tafsir', 'tafsirayat'],
    tags: ['tobat'],
    description: 'Tafsir ayat Al-Quran',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            if (!args[0] || !args[1]) {
                return sock.sendMessage(from, {
                    text: '❌ Format salah!\n\n💡 Gunakan:\n.tafsir <no_surah> <no_ayat>\n\nContoh:\n.tafsir 1 2'
                }, { quoted: msg });
            }

            // React with loading
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const res = await fetch(`https://equran.id/api/v2/tafsir/${args[0]}`);
            const json = await res.json();

            if (json.code !== 200) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, {
                    text: '❌ Tafsir tidak ditemukan!'
                }, { quoted: msg });
            }

            const tafsirData = json.data.tafsir.find(a => a.ayat === parseInt(args[1]));

            if (!tafsirData) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, {
                    text: `❌ Tafsir ayat ${args[1]} tidak ditemukan!`
                }, { quoted: msg });
            }

            const caption = `📚 *TAFSIR QS. ${json.data.namaLatin}: ${args[1]}* 📚\n\n` +
                `${tafsirData.teks}`;

            await sock.sendMessage(from, { text: caption }, { quoted: msg });

            // React with success
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error('[Tafsir] Error:', e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: '❌ Terjadi kesalahan saat mengambil tafsir.\n\n💡 Coba lagi nanti.'
            }, { quoted: msg });
        }
    }
};
