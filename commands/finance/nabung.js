import { recordTransaction } from '../../utils/sheetsHelper.js';

export default {
    name: 'nabung',
    aliases: ['tabung', 'simpan'],
    tags: ['finance'],
    description: 'Catat tabungan masuk ke Google Sheets',
    access: {
        owner: false,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        
        if (args.length < 2) {
            return sock.sendMessage(from, {
                text: '❌ *Format Salah!*\n\nGunakan: `.nabung [nominal] [keterangan]`\nContoh: `.nabung 100000 sisa uang jajan`'
            }, { quoted: msg });
        }
        
        const nominal = parseInt(args[0].replace(/\D/g, ''));
        const keterangan = args.slice(1).join(' ').trim();
        
        if (isNaN(nominal) || nominal <= 0) {
            return sock.sendMessage(from, {
                text: '❌ *Nominal Tidak Valid!*\n\nNominal harus berupa angka positif.'
            }, { quoted: msg });
        }
        
        if (!keterangan) {
            return sock.sendMessage(from, {
                text: '❌ *Keterangan Kosong!*\n\nHarap berikan keterangan tabungan.'
            }, { quoted: msg });
        }
        
        try {
            await recordTransaction('Nabung', nominal, keterangan);
            
            const formattedNominal = nominal.toLocaleString('id-ID');
            return sock.sendMessage(from, {
                text: `💰 Mantap! Nabung dicatat: Rp${formattedNominal} (${keterangan})`
            }, { quoted: msg });
        } catch (err) {
            console.error('[Finance] Error recording tabungan:', err);
            return sock.sendMessage(from, {
                text: `❌ *Gagal Mencatat Tabungan!*\n\n⚠️ Error: ${err.message || err}`
            }, { quoted: msg });
        }
    }
};
