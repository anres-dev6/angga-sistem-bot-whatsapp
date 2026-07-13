import { recordTransaction } from '../../utils/sheetsHelper.js';

export default {
    name: 'masuk',
    aliases: ['pemasukan', 'pendapatan'],
    tags: ['finance'],
    description: 'Catat pemasukan keuangan ke Google Sheets',
    access: {
        owner: true,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        
        if (args.length < 2) {
            return sock.sendMessage(from, {
                text: '❌ *Format Salah!*\n\nGunakan: `.masuk [nominal] [keterangan]`\nContoh: `.masuk 1500000 gaji bulanan`'
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
                text: '❌ *Keterangan Kosong!*\n\nHarap berikan keterangan pemasukan.'
            }, { quoted: msg });
        }
        
        try {
            await recordTransaction('Pemasukan', nominal, keterangan);
            
            const formattedNominal = nominal.toLocaleString('id-ID');
            return sock.sendMessage(from, {
                text: `✅ Pemasukan dicatat: Rp${formattedNominal} (${keterangan})`
            }, { quoted: msg });
        } catch (err) {
            console.error('[Finance] Error recording pemasukan:', err);
            return sock.sendMessage(from, {
                text: `❌ *Gagal Mencatat Pemasukan!*\n\n⚠️ Error: ${err.message || err}`
            }, { quoted: msg });
        }
    }
};
