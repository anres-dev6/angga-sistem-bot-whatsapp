import { hideCommand, getHiddenCommands } from '../../Lib/hidden_commands.js';

export default {
    name: 'hide',
    aliases: ['hide', 'hidecommand'],
    tags: ['owner'],
    description: 'Hide command from menu (Owner only)',
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
                        text: '📋 *Hidden Commands*\n\nTidak ada command yang disembunyikan.\n\n💡 Usage: `.hide <command>`'
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

            // Don't allow hiding critical commands
            const protectedCommands = ['menu', 'hide', 'show', 'settag', 'menuowner'];
            if (protectedCommands.includes(commandName)) {
                return sock.sendMessage(from, {
                    text: `❌ Cannot hide protected command: \`${commandName}\``,
                    edit: progressMsg.key
                });
            }

            const success = hideCommand(commandName);

            if (success) {
                return sock.sendMessage(from, {
                    text: `✅ Command hidden: \`${commandName}\`\n\n💡 Command masih bisa digunakan, tapi tidak muncul di menu.\n\nUse \`.show ${commandName}\` to unhide.`,
                    edit: progressMsg.key
                });
            } else {
                return sock.sendMessage(from, {
                    text: `⚠️ Command \`${commandName}\` sudah hidden.`,
                    edit: progressMsg.key
                });
            }

        } catch (error) {
            console.error('[Hide Command] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ *Error!*\n\n⚠️ ${error.message}`
            }, { quoted: msg });
        }
    }
};
