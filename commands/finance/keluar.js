import { recordTransaction } from '../../utils/sheetsHelper.js';

export default {
    name: 'keluar',
    aliases: ['pengeluaran'],
    tags: ['finance'],
    description: 'Catat pengeluaran keuangan ke Google Sheets',
    access: {
        owner: true,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        
        if (args.length < 2) {
            return sock.sendMessage(from, {
                text: '❌ *Format Salah!*\n\nGunakan: `.keluar [nominal] [keterangan]`\nContoh: `.keluar 50000 makan siang`'
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
                text: '❌ *Keterangan Kosong!*\n\nHarap berikan keterangan pengeluaran.'
            }, { quoted: msg });
        }
        
        try {
            await recordTransaction('Pengeluaran', nominal, keterangan);
            
            const formattedNominal = nominal.toLocaleString('id-ID');
            return sock.sendMessage(from, {
                text: `💸 Pengeluaran dicatat: Rp${formattedNominal} (${keterangan})`
            }, { quoted: msg });
        } catch (err) {
            console.error('[Finance] Error recording pengeluaran:', err);
            return sock.sendMessage(from, {
                text: `❌ *Gagal Mencatat Pengeluaran!*\n\n⚠️ Error: ${err.message || err}`
            }, { quoted: msg });
        }
    }
};
