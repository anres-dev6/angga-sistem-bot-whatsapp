import { loadOwners, addOwner, isOwner } from '../../utils/security.js';

export default {
    name: 'addowner',
    aliases: ['addowner', 'addown'],
    tags: ['owner'],
    description: 'Add new bot owner',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        // Owner check
        if (!isOwner(sender)) {
            return sock.sendMessage(from, {
                text: "❌ Owner-only command!"
            });
        }

        try {
            // Get target from mention or quoted message
            const quoted = msg.message?.extendedTextMessage?.contextInfo;
            const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

            let targetJid = null;

            // Priority: mention > quoted > manual input
            if (mentions.length > 0) {
                targetJid = mentions[0];
            } else if (quoted?.participant) {
                targetJid = quoted.participant;
            } else if (args[0]) {
                // Manual input: .addowner 628xxx
                const number = args[0].replace(/\D/g, '');
                targetJid = number + '@s.whatsapp.net';
            }

            if (!targetJid) {
                return sock.sendMessage(from, {
                    text: `❌ *Cara pakai:*\n\n1. Tag: .addowner @user\n2. Reply: Reply pesan user lalu .addowner\n3. Manual: .addowner 628xxx`
                });
            }

            const targetNumber = targetJid.split('@')[0].replace(/\D/g, '');

            // Check if already owner
            if (isOwner(targetJid)) {
                return sock.sendMessage(from, {
                    text: `❌ ${targetNumber} sudah menjadi owner!`
                });
            }

            // Add owner
            addOwner(targetJid);

            await sock.sendMessage(from, {
                text: `✅ *Owner baru ditambahkan!*\n\n📱 Nomor: ${targetNumber}\n👥 Total owner: ${loadOwners().length}`
            });

        } catch (error) {
            console.error('[AddOwner] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ Error: ${error.message}`
            });
        }
    }
};
