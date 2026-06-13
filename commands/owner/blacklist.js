import { addBlacklist, isBlacklisted, loadBlacklist } from '../../utils/blacklist.js';
import { isOwner } from '../../utils/security.js';

export default {
    name: 'blacklist',
    aliases: ['bl'],
    tags: ['owner'],
    description: 'Blacklist a user/number from using the bot',
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

            // If "list" action or no arguments/mentions/quoted message, show list
            const showList = (args[0]?.toLowerCase() === 'list') || (args.length === 0 && mentions.length === 0 && !quoted?.participant);

            if (showList) {
                const blacklist = loadBlacklist();
                if (blacklist.length === 0) {
                    let listText = `📱 *Daftar Blacklist*\n\n_Tidak ada nomor dalam daftar blacklist._\n\n`;
                    listText += `*Cara pakai:*\n`;
                    listText += `1. Tag: \`.blacklist @user\`\n`;
                    listText += `2. Reply: Reply pesan user lalu \`.blacklist\`\n`;
                    listText += `3. Manual: \`.blacklist 62xxx\` atau \`.bl 62xxx\``;
                    return sock.sendMessage(from, { text: listText });
                }

                let listText = `📱 *Daftar Blacklist (${blacklist.length} nomor)*\n\n`;
                listText += blacklist.map((num, index) => `${index + 1}. +${num}`).join('\n');
                listText += `\n\n*Cara menggunakan command:*`;
                listText += `\n- Tag: \`.blacklist @user\``;
                listText += `\n- Reply: Reply pesan user lalu \`.blacklist\``;
                listText += `\n- Manual: \`.blacklist 62876xxx\``;
                listText += `\n- Hapus: \`.unblacklist 62876xxx\``;

                return sock.sendMessage(from, { text: listText });
            }

            let targetJid = null;

            // Priority: mention > quoted > manual input
            if (mentions.length > 0) {
                targetJid = mentions[0];
            } else if (quoted?.participant) {
                targetJid = quoted.participant;
            } else if (args.length > 0) {
                // Manual input: handles formatted phone numbers with spaces, e.g., +62 876-8876-0987
                const number = args.join('').replace(/\D/g, '');
                if (number) {
                    targetJid = number + '@s.whatsapp.net';
                }
            }

            if (!targetJid) {
                return sock.sendMessage(from, {
                    text: `❌ *Cara pakai:*\n\n1. Tag: .blacklist @user\n2. Reply: Reply pesan user lalu .blacklist\n3. Manual: .blacklist +62 876-8876-0987 atau .bl 6287688760987`
                });
            }

            const targetNumber = targetJid.split('@')[0].replace(/\D/g, '');

            // Prevent blacklisting an owner
            if (isOwner(targetJid)) {
                return sock.sendMessage(from, {
                    text: `❌ Tidak dapat mem-blacklist owner bot!`
                });
            }

            // Check if already blacklisted
            if (isBlacklisted(targetNumber)) {
                return sock.sendMessage(from, {
                    text: `❌ ${targetNumber} sudah berada di dalam blacklist!`
                });
            }

            // Add to blacklist
            addBlacklist(targetNumber);

            await sock.sendMessage(from, {
                text: `✅ *Nomor berhasil di-blacklist!*\n\n📱 Nomor: +${targetNumber}\n💬 Pesan blacklist akan dikirimkan bila nomor ini mencoba menggunakan bot.`
            });

        } catch (error) {
            console.error('[Blacklist] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ Error: ${error.message}`
            });
        }
    }
};
