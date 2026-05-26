import { showCommand, getHiddenCommands } from '../Lib/hidden_commands.js';

export default {
    name: 'show',
    aliases: ['show', 'showcommand', 'unhide'],
    tags: ['owner'],
    description: 'Show hidden command in menu (Owner only)',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            if (args.length === 0) {
                // Show list of hidden commands
                const hidden = getHiddenCommands();

                if (hidden.length === 0) {
                    return sock.sendMessage(from, {
                        text: '📋 *Hidden Commands*\n\nTidak ada command yang disembunyikan.\n\n💡 Usage: `.show <command>`'
                    }, { quoted: msg });
                }

                const list = hidden.map((cmd, i) => `${i + 1}. \`${cmd}\``).join('\n');

                return sock.sendMessage(from, {
                    text: `📋 *Hidden Commands*\n\n${list}\n\n💡 Use \`.show <command>\` to unhide`
                }, { quoted: msg });
            }

            const commandName = args[0].toLowerCase().replace('.', '');

            const progressMsg = await sock.sendMessage(from, {
                text: `⏳ Processing...`
            }, { quoted: msg });

            const success = showCommand(commandName);

            if (success) {
                return sock.sendMessage(from, {
                    text: `✅ Command unhidden: \`${commandName}\`\n\n💡 Command sekarang muncul di menu.`,
                    edit: progressMsg.key
                });
            } else {
                return sock.sendMessage(from, {
                    text: `⚠️ Command \`${commandName}\` tidak ada di hidden list.`,
                    edit: progressMsg.key
                });
            }

        } catch (error) {
            console.error('[Show Command] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ *Error!*\n\n⚠️ ${error.message}`
            }, { quoted: msg });
        }
    }
};
