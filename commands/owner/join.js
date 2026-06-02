export default {
    name: 'join',
    aliases: ['joingc', 'join'],
    tags: ['owner'],
    description: 'Join a WhatsApp group via invite link (Private Chat Only)',
    access: {
        owner: true,
        group: false,
        private: true
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        if (args.length === 0) {
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: '❌ *Link invite diperlukan!*\n\n' +
                    '📝 *Cara pakai:*\n' +
                    '`.join <link_invite>`\n\n' +
                    '💡 *Contoh:*\n' +
                    '`.join https://chat.whatsapp.com/ABC123...`'
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
            const match = inviteLink.match(/(?:https?:\/\/)?(?:chat\.)?whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{20,26})/i)
                          || inviteLink.match(/(?:https?:\/\/)?(?:chat\.)?whatsapp\.com\/([a-zA-Z0-9_-]+)/);

            if (match) {
                inviteCode = match[1];
            } else if (/^[a-zA-Z0-9_-]+$/.test(inviteLink)) {
                // Direct code
                inviteCode = inviteLink;
            } else {
                throw new Error('Format link tidak valid');
            }
        } catch (e) {
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: '❌ *Link invite tidak valid!*\n\n' +
                    '💡 Format yang diterima:\n' +
                    '• `https://chat.whatsapp.com/ABC123...`\n' +
                    '• `chat.whatsapp.com/ABC123...`\n' +
                    '• `ABC123...` (kode langsung)'
            }, { quoted: msg });
        }

        // React with ⏳ loading
        try {
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
        } catch (e) {
            console.error('[Join] Failed to send emoji reaction ⏳:', e);
        }

        try {
            // Join the group
            const response = await sock.groupAcceptInvite(inviteCode);

            console.log('[Join] Joined group:', response);

            // Get group metadata
            const metadata = await sock.groupMetadata(response);

            // React with ✅ success
            try {
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } catch (e) {
                console.error('[Join] Failed to send emoji reaction ✅:', e);
            }

            // Send success message to owner
            await sock.sendMessage(from, {
                text: `✅ *Berhasil bergabung ke grup!*\n\n` +
                    `📱 *Grup:* ${metadata.subject}\n` +
                    `👥 *Anggota:* ${metadata.participants.length}\n` +
                    `🆔 *ID:* ${response}\n\n` +
                    `👋 Bot telah mengirim salam ke grup.`
            }, { quoted: msg });

            // Send greeting to the new group
            await sock.sendMessage(response, {
                text: `👋 *Halo!*\n\n` +
                    `Saya adalah bot yang baru bergabung atas perintah Owner.\n` +
                    `Gunakan \`.menu\` untuk melihat daftar perintah.`
            });

        } catch (error) {
            console.error('[Join] Error:', error);

            // React with ❌ error
            try {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            } catch (e) {
                console.error('[Join] Failed to send emoji reaction ❌:', e);
            }

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
                text: errorMsg
            }, { quoted: msg });
        }
    }
};
