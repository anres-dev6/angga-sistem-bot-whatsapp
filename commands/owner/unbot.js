import { removeUserbot } from '../../Lib/userbot_manager.js';

export default {
    name: 'unbot',
    aliases: ['unbot'],
    tags: ['owner'],
    description: 'Putus koneksi dan hapus sesi userbot',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        if (args.length === 0) {
            return sock.sendMessage(from, {
                text: '❌ *Nomor telepon diperlukan!*\n\n' +
                      '📝 *Cara pakai:*\n' +
                      '`.unbot <nomor>`\n\n' +
                      '💡 *Contoh:*\n' +
                      '`.unbot +6289972839173`'
            }, { quoted: msg });
        }

        const targetNumber = args[0];

        try {
            const removedNumber = await removeUserbot(targetNumber);

            await sock.sendMessage(from, {
                text: `BOT REMOVED\n` +
                      `Nomor: +${removedNumber}\n` +
                      `Aturan: hanya owner`
            }, { quoted: msg });

        } catch (error) {
            console.error('[Unbot] Error:', error);
            await sock.sendMessage(from, {
                text: `❌ *Gagal menghapus userbot!*\n\n⚠️ ${error.message}`
            }, { quoted: msg });
        }
    }
};
