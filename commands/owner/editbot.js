import { editUserbotFeatures } from '../../Lib/userbot_manager.js';

export default {
    name: 'editbot',
    aliases: ['editbot'],
    tags: ['owner'],
    description: 'Tambah atau hapus fitur userbot secara realtime',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        if (args.length < 2) {
            return sock.sendMessage(from, {
                text: '❌ *Argument tidak lengkap!*\n\n' +
                      '📝 *Cara pakai:*\n' +
                      '• Tambah: `.editbot <nomor> +<fitur>`\n' +
                      '• Hapus: `.editbot <nomor> -<fitur>`\n' +
                      '• Multiple: `.editbot <nomor> +<fitur> -<fitur>`\n\n' +
                      '💡 *Contoh:*\n' +
                      '`.editbot +62899 +gl`\n' +
                      '`.editbot +62899 +gl -sticker`'
            }, { quoted: msg });
        }

        const targetNumber = args[0];
        const modifications = args.slice(1);

        try {
            const updatedBot = editUserbotFeatures(targetNumber, modifications);

            await sock.sendMessage(from, {
                text: `FEATURE UPDATED\n` +
                      `Nomor: +${updatedBot.number}\n` +
                      `Fitur: ${updatedBot.features.join(', ') || 'tidak ada'}\n` +
                      `Aturan: tidak pairing ulang`
            }, { quoted: msg });

        } catch (error) {
            console.error('[EditBot] Error:', error);
            await sock.sendMessage(from, {
                text: `❌ *Gagal mengupdate fitur!*\n\n⚠️ ${error.message}`
            }, { quoted: msg });
        }
    }
};
