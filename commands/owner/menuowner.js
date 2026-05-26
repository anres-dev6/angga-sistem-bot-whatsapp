export default {
    name: 'menuowner',
    aliases: ['menuowner', 'ownermenu'],
    tags: ['owner'],
    description: 'Owner-only menu (Hidden from regular menu)',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            const { getCommandTag } = await import('../../Lib/command_tags.js');

            // Get all commands
            const commands = global.commands || new Map();

            // Filter owner-only commands
            const ownerCommands = [];
            for (const [name, cmd] of commands) {
                if (cmd.access && cmd.access.owner === true) {
                    const customTag = getCommandTag(name);
                    const tag = customTag || (Array.isArray(cmd.tags) ? cmd.tags[0] : cmd.tags) || 'other';

                    ownerCommands.push({
                        name,
                        description: cmd.description || 'No description',
                        tag
                    });
                }
            }

            if (ownerCommands.length === 0) {
                return sock.sendMessage(from, {
                    text: '❌ No owner commands found.'
                }, { quoted: msg });
            }

            // Group by tag
            const grouped = {};
            ownerCommands.forEach(cmd => {
                if (!grouped[cmd.tag]) {
                    grouped[cmd.tag] = [];
                }
                grouped[cmd.tag].push(cmd);
            });

            // Build menu
            let menuText = '👑 *OWNER MENU*\n\n';
            menuText += `Total: ${ownerCommands.length} commands\n\n`;

            const tagEmojis = {
                download: '📥',
                tools: '🛠️',
                fun: '🎮',
                group: '👥',
                owner: '👑',
                ai: '🤖',
                game: '🎯',
                other: '📦'
            };

            for (const [tag, cmds] of Object.entries(grouped)) {
                const emoji = tagEmojis[tag] || '📦';
                menuText += `${emoji} *${tag.toUpperCase()}*\n`;

                cmds.forEach(cmd => {
                    menuText += `  • \`.${cmd.name}\`\n`;
                    if (cmd.description && cmd.description !== 'No description') {
                        menuText += `    _${cmd.description}_\n`;
                    }
                });

                menuText += '\n';
            }

            menuText += '💡 *Owner Commands:*\n';
            menuText += '• `.hide <cmd>` - Hide command\n';
            menuText += '• `.show <cmd>` - Show command\n';
            menuText += '• `.settag <cmd> <tag>` - Change tag\n';
            menuText += '• `.menuowner` - This menu';

            return sock.sendMessage(from, {
                text: menuText
            }, { quoted: msg });

        } catch (error) {
            console.error('[MenuOwner] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ *Error!*\n\n⚠️ ${error.message}`
            }, { quoted: msg });
        }
    }
};
