import { setCommandTag, getCommandTag, getAllCustomTags } from '../../Lib/command_tags.js';

export default {
    name: 'settag',
    aliases: ['settag', 'changetag'],
    tags: ['owner'],
    description: 'Change command tag/category (Owner only)',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            if (args.length === 0) {
                // Show all custom tags
                const customTags = getAllCustomTags();
                const entries = Object.entries(customTags);

                if (entries.length === 0) {
                    return sock.sendMessage(from, {
                        text: '📋 *Custom Tags*\n\nBelum ada custom tags.\n\n💡 Usage:\n`.settag <command> <tag>`\n\nExample:\n`.settag yt download`'
                    }, { quoted: msg });
                }

                const list = entries.map(([cmd, tag], i) => `${i + 1}. \`${cmd}\` → ${tag}`).join('\n');

                return sock.sendMessage(from, {
                    text: `📋 *Custom Tags*\n\n${list}\n\n💡 Use \`.settag <command> <tag>\` to change`
                }, { quoted: msg });
            }

            if (args.length < 2) {
                return sock.sendMessage(from, {
                    text: '❌ *Invalid usage!*\n\n💡 Usage:\n`.settag <command> <tag>`\n\nExample:\n`.settag yt download`'
                }, { quoted: msg });
            }

            const commandName = args[0].toLowerCase().replace('.', '');
            const newTag = args.slice(1).join(' ').toLowerCase();

            const progressMsg = await sock.sendMessage(from, {
                text: `⏳ Processing...`
            }, { quoted: msg });

            // Validate tag
            const validTags = ['download', 'tools', 'fun', 'group', 'owner', 'ai', 'game', 'other'];
            if (!validTags.includes(newTag)) {
                return sock.sendMessage(from, {
                    text: `❌ *Invalid tag!*\n\n✅ Valid tags:\n${validTags.map(t => `• ${t}`).join('\n')}\n\n💡 Example: \`.settag yt download\``,
                    edit: progressMsg.key
                });
            }

            setCommandTag(commandName, newTag);

            return sock.sendMessage(from, {
                text: `✅ Tag updated!\n\n📝 Command: \`${commandName}\`\n🏷️ New tag: **${newTag}**\n\n💡 Restart bot untuk apply changes.`,
                edit: progressMsg.key
            });

        } catch (error) {
            console.error('[SetTag Command] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ *Error!*\n\n⚠️ ${error.message}`
            }, { quoted: msg });
        }
    }
};
