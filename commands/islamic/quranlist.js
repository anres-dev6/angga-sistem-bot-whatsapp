import fetch from 'node-fetch';

export default {
    name: 'quranlist',
    aliases: ['quranlist', 'listsurah'],
    tags: ['tobat'],
    description: 'Daftar semua surah Al-Quran',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            // React with loading
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            const res = await fetch('https://equran.id/api/v2/surat');
            const json = await res.json();

            if (json.code !== 200) throw new Error('Error fetching data');

            const list = json.data.map(v =>
                `${v.nomor}. ${v.namaLatin} (${v.arti}) - ${v.tempatTurun}`
            ).join('\n');

            await sock.sendMessage(from, {
                text: `📖 *DAFTAR SURAH AL-QURAN* 📖\n\n${list}\n\n💡 Ketik .quran <nomor> untuk detail surah.`
            }, { quoted: msg });

            // React with success
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error('[QuranList] Error:', e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: '❌ Terjadi kesalahan saat mengambil daftar surah.\n\n💡 Coba lagi nanti.'
            }, { quoted: msg });
        }
    }
};
