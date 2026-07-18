import { enableAntiDelete, disableAntiDelete, isAntiDeleteEnabled } from '../../Lib/antidelete_manager.js';

export default {
    name: 'ad',
    aliases: ['antidelete', 'antitarik'],
    tags: ['utility'],
    description: 'Aktifkan atau matikan Anti-Delete (Anti-Tarik Pesan) secara global',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args, { isOwner }) => {
        const from = msg.key.remoteJid;

        // Jika dijalankan oleh userbot, cek apakah fitur 'ad' diaktifkan
        if (sock.isUserbot && !isOwner) {
            const hasFeature = sock.userbotFeatures?.includes('ad');
            if (!hasFeature) {
                return sock.sendMessage(from, {
                    text: '❌ Fitur *Anti-Delete* tidak diaktifkan untuk bot ini.'
                }, { quoted: msg });
            }
        }

        const action = args[0]?.toLowerCase();
        const currentStatus = isAntiDeleteEnabled();

        if (!action || action === 'status') {
            return sock.sendMessage(from, {
                text: `🛡️ *Anti-Delete Status (Global)*\n\n` +
                      `Status: ${currentStatus ? '✅ *ON*' : '❌ *OFF*'}\n\n` +
                      `📌 *Cara pakai:*\n` +
                      `• \`.ad on\`  → Aktifkan secara Global\n` +
                      `• \`.ad off\` → Matikan secara Global`
            }, { quoted: msg });
        }

        if (action === 'on') {
            if (currentStatus) {
                return sock.sendMessage(from, {
                    text: '⚠️ Anti-Delete sudah *ON* secara Global.'
                }, { quoted: msg });
            }
            enableAntiDelete();
            return sock.sendMessage(from, {
                text: `✅ *Anti-Delete AKTIF (Global)!*\n\n` +
                      `🛡️ Setiap pesan yang ditarik di chat mana pun akan diteruskan ke Owner.`
            }, { quoted: msg });
        }

        if (action === 'off') {
            if (!currentStatus) {
                return sock.sendMessage(from, {
                    text: '⚠️ Anti-Delete sudah *OFF* secara Global.'
                }, { quoted: msg });
            }
            disableAntiDelete();
            return sock.sendMessage(from, {
                text: `❌ *Anti-Delete DIMATIKAN (Global).*\n\n` +
                      `Pesan yang ditarik tidak akan lagi dilaporkan.`
            }, { quoted: msg });
        }

        return sock.sendMessage(from, {
            text: '❌ Opsi tidak valid.\n\nGunakan: `.ad on` atau `.ad off`'
        }, { quoted: msg });
    }
};
