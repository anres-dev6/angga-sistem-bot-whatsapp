import { recordTransaction } from '../../utils/sheetsHelper.js';

export default {
    name: 'ab',
    aliases: ['ambiltabungan', 'tariktabungan'],
    tags: ['finance'],
    description: 'Catat pengambilan tabungan ke Google Sheets',
    access: {
        owner: false,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        
        if (args.length < 2) {
            return sock.sendMessage(from, {
                text: '❌ *Format Salah!*\n\nGunakan: `.ab [nominal] [keterangan]`\nContoh: `.ab 50000 beli kado ultah`'
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
                text: '❌ *Keterangan Kosong!*\n\nHarap berikan keterangan pengambilan.'
            }, { quoted: msg });
        }
        
        try {
            await recordTransaction('Ambil Tabungan', nominal, keterangan);
            
            const formattedNominal = nominal.toLocaleString('id-ID');
            return sock.sendMessage(from, {
                text: `⚠️ Tabungan diambil: Rp${formattedNominal} (${keterangan})`
            }, { quoted: msg });
        } catch (err) {
            console.error('[Finance] Error recording ambil tabungan:', err);
            return sock.sendMessage(from, {
                text: `❌ *Gagal Mencatat Pengambilan Tabungan!*\n\n⚠️ Error: ${err.message || err}`
            }, { quoted: msg });
        }
    }
};
