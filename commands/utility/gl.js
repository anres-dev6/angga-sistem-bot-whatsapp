import { toggleUserbotGl } from '../../Lib/userbot_manager.js';

export default {
    name: 'gl',
    aliases: ['globallistener'],
    tags: ['tools'],
    description: 'Aktifkan atau nonaktifkan Global Listener pada bot',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        // Verify if it is a userbot
        if (!sock.isUserbot) {
            return sock.sendMessage(from, {
                text: '❌ Perintah ini hanya dapat dieksekusi oleh Userbot.'
            }, { quoted: msg });
        }

        // Verify if userbot has 'gl' feature permission
        if (!sock.userbotFeatures.includes('gl')) {
            return sock.sendMessage(from, {
                text: '❌ Fitur ini tidak diaktifkan oleh Owner.'
            }, { quoted: msg });
        }

        if (args.length === 0) {
            return sock.sendMessage(from, {
                text: `ℹ️ *Status Global Listener: ${sock.userbotGl ? 'ENABLED' : 'DISABLED'}*\n\n` +
                      `📝 *Cara pakai:*\n` +
                      `• \`.gl on\` untuk mengaktifkan\n` +
                      `• \`.gl off\` untuk menonaktifkan`
            }, { quoted: msg });
        }

        const action = args[0].toLowerCase();

        if (action === 'on') {
            toggleUserbotGl(sock.userbotNumber, true);
            await sock.sendMessage(from, {
                text: 'GLOBAL LISTENER ENABLED'
            }, { quoted: msg });
        } else if (action === 'off') {
            toggleUserbotGl(sock.userbotNumber, false);
            await sock.sendMessage(from, {
                text: 'GLOBAL LISTENER DISABLED'
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                text: '❌ Pilihan tidak valid. Gunakan `on` atau `off`.'
            }, { quoted: msg });
        }
    }
};
