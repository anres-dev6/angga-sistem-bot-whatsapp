import fetch from 'node-fetch';

export default {
    name: 'quranaudio',
    aliases: ['quranaudio', 'audiosurah', 'playsurah'],
    tags: ['tobat'],
    description: 'Play audio full surah Al-Quran',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            if (!args[0]) {
                return sock.sendMessage(from, {
                    text: '❌ Masukan nomor surah!\n\n💡 Contoh:\n.quranaudio 1\n.playsurah 18\n\n📋 Gunakan .quranlist untuk lihat daftar surah'
                }, { quoted: msg });
            }

            const noSurah = args[0];

            // React with loading
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const res = await fetch(`https://equran.id/api/v2/surat/${noSurah}`);
            const json = await res.json();

            if (json.code !== 200) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, {
                    text: '❌ Surah tidak ditemukan!'
                }, { quoted: msg });
            }

            const d = json.data;

            // Get audio URL - using Misyari Rashid Alafasy (05)
            const audioUrl = d.audioFull && d.audioFull['05']
                ? d.audioFull['05']
                : null;

            if (!audioUrl) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, {
                    text: '❌ Audio tidak tersedia untuk surah ini.\n\n💡 Coba gunakan .quransurah untuk audio per ayat.'
                }, { quoted: msg });
            }

            const caption = `🎧 *AUDIO FULL SURAH* 🎧\n\n` +
                `📖 ${d.namaLatin} (${d.nama})\n` +
                `📌 Arti: ${d.arti}\n` +
                `📌 Jumlah Ayat: ${d.jumlahAyat}\n` +
                `📌 Tempat Turun: ${d.tempatTurun}\n\n` +
                `🎙️ Qari: Misyari Rashid Alafasy`;

            // Send audio
            await sock.sendMessage(from, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${d.namaLatin}.mp3`
            }, { quoted: msg });

            // Send caption
            await sock.sendMessage(from, {
                text: caption
            }, { quoted: msg });

            // React with success
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error('[QuranAudio] Error:', e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: '❌ Terjadi kesalahan saat mengambil audio.\n\n💡 Coba lagi nanti.'
            }, { quoted: msg });
        }
    }
};
