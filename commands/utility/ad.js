import { enableAntiDelete, disableAntiDelete, isAntiDeleteEnabled } from '../../Lib/antidelete_manager.js';

export default {
    name: 'ad',
    aliases: ['antidelete', 'antitarik'],
    tags: ['utility'],
    description: 'Aktifkan atau matikan Anti-Delete (Anti-Tarik Pesan) di chat ini',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args, { isAdmin, isOwner, isGroup }) => {
        const from = msg.key.remoteJid;

        // Di grup hanya admin/owner yang bisa toggle
        if (isGroup && !isAdmin && !isOwner) {
            return sock.sendMessage(from, {
                text: '❌ Hanya *Admin* atau *Owner* yang bisa menggunakan perintah ini.'
            }, { quoted: msg });
        }

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
        const currentStatus = isAntiDeleteEnabled(from);

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
                    text: '⚠️ Anti-Delete sudah *ON* di chat ini.'
                }, { quoted: msg });
            }
            enableAntiDelete(from);
            return sock.sendMessage(from, {
                text: `✅ *Anti-Delete AKTIF!*\n\n` +
                      `🛡️ Setiap pesan yang ditarik di chat ini akan diteruskan ke Owner.`
            }, { quoted: msg });
        }

        if (action === 'off') {
            if (!currentStatus) {
                return sock.sendMessage(from, {
                    text: '⚠️ Anti-Delete sudah *OFF* di chat ini.'
                }, { quoted: msg });
            }
            disableAntiDelete(from);
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
