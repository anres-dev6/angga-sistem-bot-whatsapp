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

        const botNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
        if (!botNumber) return;

        const action = args[0]?.toLowerCase();
        const currentStatus = isAntiDeleteEnabled(botNumber);

        if (!action || action === 'status') {
            return sock.sendMessage(from, {
                text: `🛡️ *Anti-Delete Status*\n\n` +
                      `Status: ${currentStatus ? '✅ *ON*' : '❌ *OFF*'}\n\n` +
                      `📌 *Cara pakai:*\n` +
                      `• \`.ad on\`  → Aktifkan\n` +
                      `• \`.ad off\` → Matikan`
            }, { quoted: msg });
        }

        if (action === 'on') {
            if (currentStatus) {
                return sock.sendMessage(from, {
                    text: '⚠️ Anti-Delete sudah *ON*.'
                }, { quoted: msg });
            }
            enableAntiDelete(botNumber);
            return sock.sendMessage(from, {
                text: `✅ *Anti-Delete AKTIF!*\n\n` +
                      `🛡️ Setiap pesan atau status yang ditarik/dihapus akan diteruskan ke nomor ini.`
            }, { quoted: msg });
        }

        if (action === 'off') {
            if (!currentStatus) {
                return sock.sendMessage(from, {
                    text: '⚠️ Anti-Delete sudah *OFF*.'
                }, { quoted: msg });
            }
            disableAntiDelete(botNumber);
            return sock.sendMessage(from, {
                text: `❌ *Anti-Delete DIMATIKAN.*\n\n` +
                      `Pesan yang ditarik tidak akan lagi dilaporkan.`
            }, { quoted: msg });
        }

        return sock.sendMessage(from, {
            text: '❌ Opsi tidak valid.\n\nGunakan: `.ad on` atau `.ad off`'
        }, { quoted: msg });
    }
};
