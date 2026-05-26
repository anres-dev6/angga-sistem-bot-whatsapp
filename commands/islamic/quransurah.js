import fetch from 'node-fetch';

export default {
    name: 'quransurah',
    aliases: ['quransurah', 'ayat', 'bacaayat'],
    tags: ['tobat'],
    description: 'Baca ayat Al-Quran dengan audio',
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
                    text: '❌ Format salah!\n\n💡 Gunakan:\n.quransurah <no_surah> <no_ayat>\n\nContoh:\n.quransurah 1 2'
                }, { quoted: msg });
            }

            // React with loading
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const noSurah = args[0];
            const noAyat = parseInt(args[1]);

            const res = await fetch(`https://equran.id/api/v2/surat/${noSurah}`);
            const json = await res.json();

            if (json.code !== 200) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, {
                    text: '❌ Surah tidak ditemukan!'
                }, { quoted: msg });
            }

            const ayatData = json.data.ayat.find(a => a.nomorAyat === noAyat);

            if (!ayatData) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, {
                    text: `❌ Ayat ${noAyat} tidak ditemukan di surah ini!`
                }, { quoted: msg });
            }

            const caption = `📖 *QS. ${json.data.namaLatin}: ${noAyat}* 📖\n\n` +
                `${ayatData.teksArab}\n\n` +
                `${ayatData.teksLatin}\n\n` +
                `_"${ayatData.teksIndonesia}"_\n\n` +
                `💡 Gunakan .tafsir ${noSurah} ${noAyat} untuk tafsir`;

            // Send audio first if available
            if (ayatData.audio && ayatData.audio['05']) {
                await sock.sendMessage(from, {
                    audio: { url: ayatData.audio['05'] },
                    mimetype: 'audio/mpeg',
                    ptt: false
                }, { quoted: msg });
            }

            await sock.sendMessage(from, { text: caption }, { quoted: msg });

            // React with success
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error('[QuranSurah] Error:', e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: '❌ Terjadi kesalahan saat mengambil ayat.\n\n💡 Coba lagi nanti.'
            }, { quoted: msg });
        }
    }
};
