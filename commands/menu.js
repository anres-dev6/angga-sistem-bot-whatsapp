import { commands } from "../handler/command.js";

export default {
    name: 'menu',
    aliases: ['m', 'mnu'],
    tags: ['main'],
    description: 'Tampilkan menu bot',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        const { isCommandHidden } = await import('../Lib/hidden_commands.js');
        const { getCommandTag } = await import('../Lib/command_tags.js');

        const tagMap = {};
        const excludedCommands = ['hide', 'show', 'settag', 'menuowner'];

        commands.forEach((cmd) => {
            if (cmd.hidden || isCommandHidden(cmd.name)) return;
            if (cmd.access && cmd.access.owner === true) return;
            if (excludedCommands.includes(cmd.name)) return;

            const customTag = getCommandTag(cmd.name);
            const tag = customTag || (Array.isArray(cmd.tags) ? cmd.tags[0] : cmd.tags) || 'others';

            if (!tagMap[tag]) tagMap[tag] = [];
            tagMap[tag].push(cmd.name);
        });

        const categoryEmojis = {
            'main':      '🏠',
            'primbon':   '🔮',
            'tools':     '🛠️',
            'sticker':   '🎨',
            'game':      '🎮',
            'download':  '📥',
            'admin':     '👑',
            'tobat':     '📖',
            'grup':      '👥',
            'converter': '🔄',
            'info':      'ℹ️',
            'owner':     '👤',
            'others':    '🙂‍↔️'
        };

        // Konversi teks biasa ke monospace Unicode
        const toMono = (str) => {
            return str.split('').map(c => {
                if (c >= 'a' && c <= 'z') return String.fromCodePoint(0x1D670 + (c.charCodeAt(0) - 97));
                if (c >= 'A' && c <= 'Z') return String.fromCodePoint(0x1D670 + (c.charCodeAt(0) - 65) - 32); // uppercase tetap monospace
                if (c >= '0' && c <= '9') return String.fromCodePoint(0x1D7F6 + (c.charCodeAt(0) - 48));
                return c;
            }).join('');
        };

        const LINE = '━━━━━━━━━━━━━━━━━━━━━';

        const requestedTag = args[0]?.toLowerCase();

        // Tampilkan semua kategori
        if (!requestedTag) {
            let menuText = `${toMono('cmd')} : ${toMono('.menu')}\n${LINE}\n`;

            for (const [tag, cmds] of Object.entries(tagMap)) {
                const emoji = categoryEmojis[tag] || '📦';
                const padded = toMono(tag).padEnd(12);
                menuText += `${emoji} ${padded} » ${toMono('.menu ' + tag)}\n`;
            }

            menuText += `${LINE}\n`;
            menuText += `💡 ${toMono('.menu all')} » ${toMono('semua command')}\n`;
            menuText += `💡 ${toMono('.menu [kategori]')} » ${toMono('detail')}`;

            return await sock.sendMessage(from, { text: menuText });
        }

        // Tampilkan semua command dikelompokkan per tag
        if (requestedTag === 'all') {
            let menuText = `${toMono('cmd')} : ${toMono('.menu all')}\n${LINE}\n`;

            for (const [tag, cmds] of Object.entries(tagMap)) {
                const emoji = categoryEmojis[tag] || '📦';
                menuText += `\n${emoji} ${toMono(tag.toUpperCase())}\n`;
                cmds.forEach(name => {
                    menuText += `  ${toMono('›')} ${toMono('.' + name)}\n`;
                });
            }

            menuText += `\n${LINE}`;
            return await sock.sendMessage(from, { text: menuText });
        }

        // Tampilkan kategori spesifik
        if (tagMap[requestedTag]) {
            const emoji = categoryEmojis[requestedTag] || '📦';
            let menuText = `${toMono('cmd')} : ${toMono('.menu ' + requestedTag)}\n${LINE}\n`;
            menuText += `${emoji} ${toMono(requestedTag.toUpperCase())}\n${LINE}\n`;

            tagMap[requestedTag].forEach(name => {
                menuText += `  ${toMono('›')} ${toMono('.' + name)}\n`;
            });

            menuText += LINE;
            return await sock.sendMessage(from, { text: menuText });
        }

        // Kategori tidak ditemukan
        const availableCategories = Object.keys(tagMap).map(t => toMono('.' + t)).join(', ');
        await sock.sendMessage(from, {
            text: `❌ ${toMono('Kategori "' + requestedTag + '" tidak ditemukan.')}\n\n${LINE}\n📋 ${toMono('Kategori tersedia:')}\n${availableCategories}\n${LINE}\n💡 ${toMono('Gunakan: .menu [kategori]')}`
        });
    }
};