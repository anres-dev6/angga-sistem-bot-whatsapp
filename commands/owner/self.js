import { enableSelfMode, disableSelfMode, isSelfModeEnabled } from '../../Lib/self_manager.js';

export default {
    name: 'self',
    aliases: ['selfmode', 'public'],
    tags: ['owner'],
    description: 'Atur bot merespon anggota grup atau hanya owner',
    access: {
        owner: true,
        group: false,
        private: false
    },
    run: async (sock, msg, args, { isGroup }) => {
        const from = msg.key.remoteJid;
        const mode = args[0]?.toLowerCase();

        if (mode === 'on') {
            let groupName = '';
            if (isGroup) {
                try {
                    const metadata = await sock.groupMetadata(from);
                    groupName = metadata.subject || '';
                } catch (error) {
                    console.error('[Self Mode] Failed to read group metadata:', error.message);
                }
            }

            const saved = enableSelfMode(isGroup ? from : null, groupName);
            return sock.sendMessage(from, {
                text: saved
                    ? '✅ *Self Mode ON*\n\nBot hanya merespon owner. Fitur owner tetap aman.'
                    : '❌ Gagal menyimpan Self Mode.'
            }, { quoted: msg });
        }

        if (mode === 'off') {
            const saved = disableSelfMode(isGroup ? from : null);
            return sock.sendMessage(from, {
                text: saved
                    ? '✅ *Self Mode OFF*\n\nBot sekarang bisa merespon anggota grup untuk fitur non-owner.'
                    : '❌ Gagal menyimpan Self Mode.'
            }, { quoted: msg });
        }

        const enabled = isSelfModeEnabled(isGroup ? from : null);
        return sock.sendMessage(from, {
            text: `🤖 *Self Mode Status*\n\nStatus: ${enabled ? 'ON ✅' : 'OFF ❌'}\n\nCara pakai:\n- .self on  = hanya owner\n- .self off = anggota grup bisa pakai fitur non-owner`
        }, { quoted: msg });
    }
};
