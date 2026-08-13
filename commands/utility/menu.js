import { commands } from "../../handler/command.js";

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
        const m = msg;

        const { isCommandHidden } = await import('../../Lib/hidden_commands.js');
        const { getCommandTag } = await import('../../Lib/command_tags.js');

        const tagMap = {};
        const excludedCommands = ['hide', 'show', 'settag', 'menuowner'];

        // Standardize & normalize tag names across aliases
        const normalizeTag = (t) => {
            if (!t) return 'others';
            const clean = t.toLowerCase().trim();
            if (clean === 'utility' || clean === 'tool') return 'tools';
            if (clean === 'group') return 'grup';
            if (clean === 'islamic' || clean === 'agama') return 'tobat';
            return clean;
        };

        commands.forEach((cmd) => {
            if (cmd.hidden || isCommandHidden(cmd.name)) return;
            if (sock.isUserbot && !sock.userbotFeatures.includes(cmd.name)) return;
            if (cmd.access && cmd.access.owner === true && !sock.isUserbot) return;
            if (excludedCommands.includes(cmd.name)) return;

            const customTag = getCommandTag(cmd.name);
            const cmdTags = customTag 
                ? [customTag] 
                : (Array.isArray(cmd.tags) ? cmd.tags : [cmd.tags || 'others']);

            cmdTags.forEach(rawTag => {
                const tag = normalizeTag(rawTag);
                if (!tagMap[tag]) tagMap[tag] = [];
                if (!tagMap[tag].includes(cmd.name)) {
                    tagMap[tag].push(cmd.name);
                }
            });
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

        // Convert plain text to Unicode Monospace
        const toMono = (str) => {
            return str.split('').map(c => {
                if (c >= 'a' && c <= 'z') return String.fromCodePoint(0x1D68A + (c.charCodeAt(0) - 97));
                if (c >= 'A' && c <= 'Z') return String.fromCodePoint(0x1D670 + (c.charCodeAt(0) - 65));
                if (c >= '0' && c <= '9') return String.fromCodePoint(0x1D7F6 + (c.charCodeAt(0) - 48));
                return c;
            }).join('');
        };

        const LINE = '━━━━━━━━━━━━━━━━━━━━━';

        let requestedInput = args[0]?.toLowerCase().trim();
        let requestedTag = requestedInput ? normalizeTag(requestedInput) : null;

        // Tampilkan semua kategori utama jika tanpa argumen
        if (!requestedTag) {
            let menuText = `${toMono('cmd')} : ${toMono('.menu')}\n${LINE}\n`;

            for (const [tag, cmds] of Object.entries(tagMap)) {
                if (!cmds || cmds.length === 0) continue;
                const emoji = categoryEmojis[tag] || '📦';
                const padded = toMono(tag).padEnd(12);
                menuText += `${emoji} ${padded} » ${toMono('.menu ' + tag)}\n`;
            }

            menuText += `${LINE}\n`;
            menuText += `💡 ${toMono('.menu all')} » ${toMono('semua command')}\n`;
            menuText += `💡 ${toMono('.menu [kategori]')} » ${toMono('detail')}`;

            return await sock.sendMessage(from, { text: menuText }, { quoted: m });
        }

        // Tampilkan semua command dikelompokkan per tag jika requestedTag === 'all'
        if (requestedTag === 'all') {
            let menuText = `${toMono('cmd')} : ${toMono('.menu all')}\n${LINE}\n`;

            for (const [tag, cmds] of Object.entries(tagMap)) {
                if (!cmds || cmds.length === 0) continue;
                const emoji = categoryEmojis[tag] || '📦';
                menuText += `\n${emoji} ${toMono(tag.toUpperCase())}\n`;
                cmds.forEach(name => {
                    menuText += `  ${toMono('›')} ${toMono('.' + name)}\n`;
                });
            }

            menuText += `\n${LINE}`;
            return await sock.sendMessage(from, { text: menuText }, { quoted: m });
        }

        // Tampilkan kategori spesifik
        if (tagMap[requestedTag] && tagMap[requestedTag].length > 0) {
            const emoji = categoryEmojis[requestedTag] || '📦';
            let menuText = `${toMono('cmd')} : ${toMono('.menu ' + requestedTag)}\n${LINE}\n`;
            menuText += `${emoji} ${toMono(requestedTag.toUpperCase())}\n${LINE}\n`;

            tagMap[requestedTag].forEach(name => {
                menuText += `  ${toMono('›')} ${toMono('.' + name)}\n`;
            });

            menuText += LINE;
            return await sock.sendMessage(from, { text: menuText }, { quoted: m });
        }

        // Jika kategori tidak ditemukan
        const availableCategories = Object.keys(tagMap)
            .filter(t => tagMap[t] && tagMap[t].length > 0)
            .map(t => toMono('.' + t))
            .join(', ');

        await sock.sendMessage(from, {
            text: `❌ ${toMono('Kategori "' + (requestedInput || requestedTag) + '" tidak ditemukan.')}\n\n${LINE}\n📋 ${toMono('Kategori tersedia:')}\n${availableCategories}\n${LINE}\n💡 ${toMono('Gunakan: .menu [kategori]')}`
        }, { quoted: m });
    }
};