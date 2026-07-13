import { getFinanceSummary } from '../../utils/sheetsHelper.js';

export default {
    name: 'total',
    aliases: ['totalfinance', 'rekap', 'rekapfin'],
    tags: ['finance'],
    description: 'Tampilkan rekapitulasi keuangan dan tabungan bulan ini dari Google Sheets',
    access: {
        owner: false,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        
        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
            
            const summary = await getFinanceSummary();
            
            const expStr = summary.pengeluaranBulanIni.toLocaleString('id-ID');
            const saveStr = summary.nabungBulanIni.toLocaleString('id-ID');
            const balStr = summary.sisaTabungan.toLocaleString('id-ID');
            
            const text = `📊 *REKAP KEUANGAN & TABUNGAN*
📅 Tahun: *${summary.year}*
🗓 Bulan: *${summary.currentMonthName}*

💸 *Pengeluaran Bulan Ini:* Rp${expStr}
💰 *Nabung Bulan Ini:* Rp${saveStr}

━━━━━━━━━━━━━━━━━━━━
💳 *Sisa Saldo Tabungan:* Rp${balStr}

💡 _Data direkap otomatis secara real-time dari Google Sheets._`;

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            return sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('[Finance] Error getting summary:', err);
            try {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            } catch {}
            return sock.sendMessage(from, {
                text: `❌ *Gagal Mengambil Rekap Keuangan!*\n\n⚠️ Error: ${err.message || err}\n\n💡 Pastikan SPREADSHEET_ID dan GOOGLE_CREDENTIALS telah disetel dengan benar di environment.`
            }, { quoted: msg });
        }
    }
};
