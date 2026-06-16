import { loadUserbots } from '../../Lib/userbot_manager.js';

export default {
    name: 'listbot',
    aliases: ['listbot', 'userbots', 'bots'],
    tags: ['owner'],
    description: 'Tampilkan daftar semua userbot yang terdaftar',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const bots = loadUserbots();

        if (bots.length === 0) {
            return sock.sendMessage(from, {
                text: '📋 *Belum ada userbot terdaftar.*\n\nGunakan `.addbot <nomor> /<fitur>` untuk menambahkan.'
            }, { quoted: msg });
        }

        let responseText = '📋 *DAFTAR USERBOTS*\n\n';

        bots.forEach((bot, index) => {
            const isActive = global.userbotSockets.has(bot.number);
            responseText += `${index + 1}. *+${bot.number}*\n` +
                            `   Status: ${bot.paired ? '🟢 Paired' : '🔴 Unpaired'}${isActive ? ' (Active)' : ''}\n` +
                            `   Global Listener: ${bot.gl ? '✅ Active' : '❌ Inactive'}\n` +
                            `   Fitur: ${bot.features.join(', ') || 'tidak ada'}\n` +
                            `   Owner: +${bot.owner}\n` +
                            `   Dibuat: ${new Date(bot.createdAt).toLocaleDateString('id-ID')}\n\n`;
        });

        await sock.sendMessage(from, { text: responseText }, { quoted: msg });
    }
};
