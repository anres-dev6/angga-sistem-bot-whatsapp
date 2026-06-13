import { removeBlacklist, isBlacklisted, loadBlacklist } from '../../utils/blacklist.js';
import { isOwner } from '../../utils/security.js';

export default {
    name: 'unblacklist',
    aliases: ['unbl'],
    tags: ['owner'],
    description: 'Unblacklist a user/number',
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
            const targets = [];

            // Get target from mention or quoted message
            const quoted = msg.message?.extendedTextMessage?.contextInfo;
            const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

            if (mentions.length > 0) {
                for (const m of mentions) {
                    const number = m.split('@')[0].replace(/\D/g, '');
                    if (number) targets.push(number);
                }
            } else if (quoted?.participant) {
                const number = quoted.participant.split('@')[0].replace(/\D/g, '');
                if (number) targets.push(number);
            } else if (args.length > 0) {
                const blacklist = loadBlacklist();
                for (const arg of args) {
                    const cleanArg = arg.trim();
                    const num = parseInt(cleanArg);
                    if (/^\d+$/.test(cleanArg) && !isNaN(num) && num > 0 && num <= blacklist.length) {
                        // Resolve from index
                        targets.push(blacklist[num - 1]);
                    } else {
                        // Resolve from phone number
                        const number = cleanArg.replace(/\D/g, '');
                        if (number) {
                            targets.push(number);
                        }
                    }
                }
            }

            if (targets.length === 0) {
                return sock.sendMessage(from, {
                    text: `❌ *Cara pakai:*\n\n1. Tag: \`.unblacklist @user\`\n2. Reply: Reply pesan user lalu \`.unblacklist\`\n3. Manual: \`.unblacklist +62 876-8876-0987\`\n4. Index: \`.unblacklist 1\` atau \`.unbl 1 2\` (jika lebih dari satu)`
                });
            }

            const removed = [];
            const notFound = [];

            for (const targetNumber of targets) {
                if (isBlacklisted(targetNumber)) {
                    removeBlacklist(targetNumber);
                    removed.push(targetNumber);
                } else {
                    notFound.push(targetNumber);
                }
            }

            let responseText = '';
            if (removed.length > 0) {
                responseText += `✅ *Berhasil dihapus dari blacklist:*\n${removed.map(num => `- +${num}`).join('\n')}\n\n`;
            }
            if (notFound.length > 0) {
                responseText += `❌ *Tidak ada dalam blacklist:*\n${notFound.map(num => `- +${num}`).join('\n')}`;
            }

            await sock.sendMessage(from, { text: responseText.trim() });

        } catch (error) {
            console.error('[Unblacklist] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ Error: ${error.message}`
            });
        }
    }
};
