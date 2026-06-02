import { enableSelfMode, disableSelfMode, isSelfModeEnabled } from '../../Lib/self_manager.js';

export default {
    name: 'self',
    aliases: ['selfmode', 'public', 'openm', 'safem', 'safemode'],
    tags: ['owner'],
    description: 'Atur bot merespon anggota grup atau hanya owner',
    access: {
        owner: true,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const mode = args[0]?.toLowerCase();

        if (mode === 'on') {
            const saved = enableSelfMode(null); // Always global
            return sock.sendMessage(from, {
                text: saved ? 'self mode on' : '❌ Gagal menyimpan Self Mode.'
            }, { quoted: msg });
        }

        if (mode === 'off') {
            const saved = disableSelfMode(null); // Always global
            return sock.sendMessage(from, {
                text: saved ? 'self mode off' : '❌ Gagal menyimpan Self Mode.'
            }, { quoted: msg });
        }

        const enabled = isSelfModeEnabled(null); // Check global status
        return sock.sendMessage(from, {
            text: `self mode status: ${enabled ? 'on' : 'off'}`
        }, { quoted: msg });
    }
};
