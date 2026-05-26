export default {
    name: 'addbot',
    aliases: ['addbot', 'joingroup'],
    tags: ['owner'],
    description: 'Tambahkan bot ke grup menggunakan link invite',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        if (args.length === 0) {
            return sock.sendMessage(from, {
                text: '❌ *Link invite diperlukan!*\n\n' +
                    '📝 *Cara pakai:*\n' +
                    '`.addbot <link_invite>`\n\n' +
                    '💡 *Contoh:*\n' +
                    '`.addbot https://chat.whatsapp.com/ABC123...`'
            }, { quoted: msg });
        }

        const inviteLink = args[0];

        // Extract invite code from link
        let inviteCode;
        try {
            // Support multiple formats:
            // https://chat.whatsapp.com/ABC123
            // chat.whatsapp.com/ABC123
            // ABC123 (direct code)
            const match = inviteLink.match(/(?:https?:\/\/)?(?:chat\.)?whatsapp\.com\/([a-zA-Z0-9_-]+)/);

            if (match) {
                inviteCode = match[1];
            } else if (/^[a-zA-Z0-9_-]+$/.test(inviteLink)) {
                // Direct code
                inviteCode = inviteLink;
            } else {
                throw new Error('Format link tidak valid');
            }
        } catch (e) {
            return sock.sendMessage(from, {
                text: '❌ *Link invite tidak valid!*\n\n' +
                    '💡 Format yang diterima:\n' +
                    '• `https://chat.whatsapp.com/ABC123...`\n' +
                    '• `chat.whatsapp.com/ABC123...`\n' +
                    '• `ABC123...` (kode langsung)'
            }, { quoted: msg });
        }

        // Send loading message
        const loading = await sock.sendMessage(from, {
            text: '⏳ *Bergabung ke grup...*'
        }, { quoted: msg });

        try {
            // Join the group
            const response = await sock.groupAcceptInvite(inviteCode);

            console.log('[AddBot] Joined group:', response);

            // Get group metadata
            const metadata = await sock.groupMetadata(response);

            // Send success message to owner
            await sock.sendMessage(from, {
                text: `✅ *Berhasil bergabung!*\n\n` +
                    `📱 *Grup:* ${metadata.subject}\n` +
                    `👥 *Anggota:* ${metadata.participants.length}\n` +
                    `🆔 *ID:* ${response}\n\n` +
                    `💡 Gunakan \`.listgrup\` untuk melihat semua grup`
            }, { quoted: msg });

            // Send greeting to the new group
            await sock.sendMessage(response, {
                text: `👋 *Halo!*\n\n` +
                    `Saya adalah bot yang baru bergabung.\n` +
                    `Gunakan \`.menu\` untuk melihat daftar perintah.`
            });

            // Delete loading message
            await sock.sendMessage(from, { delete: loading.key });

        } catch (error) {
            console.error('[AddBot] Error:', error);

            let errorMsg = '❌ *Gagal bergabung ke grup!*\n\n';

            if (error.message?.includes('not-authorized')) {
                errorMsg += '⚠️ Link sudah tidak valid atau kadaluarsa';
            } else if (error.message?.includes('already')) {
                errorMsg += '⚠️ Bot sudah ada di grup tersebut';
            } else if (error.message?.includes('forbidden')) {
                errorMsg += '⚠️ Bot tidak diizinkan bergabung (mungkin di-ban)';
            } else {
                errorMsg += `⚠️ ${error.message || 'Unknown error'}`;
            }

            await sock.sendMessage(from, {
                text: errorMsg,
                edit: loading.key
            });
        }
    }
};
