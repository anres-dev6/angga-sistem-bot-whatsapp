import fetch from 'node-fetch';

export default {
    name: 'quran',
    aliases: ['quran', 'alquran', 'surah'],
    tags: ['tobat'],
    description: 'Info detail surah Al-Quran',
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
                    text: '❌ Masukan nomor surah!\n\n💡 Contoh:\n.quran 1\n.quranlist (lihat daftar)'
                }, { quoted: msg });
            }

            // React with loading
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const res = await fetch(`https://equran.id/api/v2/surat/${args[0]}`);
            const json = await res.json();

            if (json.code !== 200) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, {
                    text: '❌ Surah tidak ditemukan!'
                }, { quoted: msg });
            }

            const d = json.data;
            const caption = `📖 *INFO SURAH* 📖\n\n` +
                `📌 Nomor: ${d.nomor}\n` +
                `📌 Nama: ${d.namaLatin} (${d.nama})\n` +
                `📌 Arti: ${d.arti}\n` +
                `📌 Jumlah Ayat: ${d.jumlahAyat}\n` +
                `📌 Tempat Turun: ${d.tempatTurun}\n\n` +
                `*Deskripsi:*\n${d.deskripsi.replace(/<[^>]*>?/gm, '')}\n\n` +
                `💡 Gunakan .quransurah ${d.nomor} <ayat> untuk baca ayat`;

            await sock.sendMessage(from, { text: caption }, { quoted: msg });

            // React with success
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error('[Quran] Error:', e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: '❌ Terjadi kesalahan saat mengambil info surah.\n\n💡 Coba lagi nanti.'
            }, { quoted: msg });
        }
    }
};
