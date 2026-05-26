import { enableAutoDLV3, disableAutoDLV3, isAutoDLV3Enabled } from '../Lib/autodlv3_manager.js';

export default {
    name: 'autodlv3',
    tags: ['admin', 'tools'],
    description: 'Turn AutoDL V3 (Universal Engine) on/off',
    access: {
        owner: false,
        group: false,
        private: false
    },
    run: async (sock, m, args, { isGroup, isAdmin, isOwner }) => {
        const from = m.key.remoteJid;

        if (isGroup && !isAdmin && !isOwner) {
            return sock.sendMessage(from, { text: '❌ Maaf, hanya Admin yang bisa menggunakan command ini.' }, { quoted: m });
        }

        const mode = args[0]?.toLowerCase();
        const chatJid = from;

        if (mode === 'on') {
            enableAutoDLV3(chatJid);
            return sock.sendMessage(from, { text: '✅ *AutoDL V3 (Universal Engine) Activated!*' }, { quoted: m });
        }

        if (mode === 'off') {
            disableAutoDLV3(chatJid);
            return sock.sendMessage(from, { text: '❌ *AutoDL V3 Deactivated.*' }, { quoted: m });
        }

        const status = isAutoDLV3Enabled(chatJid) ? 'ON ✅' : 'OFF ❌';

        return sock.sendMessage(from, { text: `🤖 *AutoDL V3 Status*\n\nStatus: ${status}\n\nCara pakai:\n- *.autodlv3 on* (Aktifkan)\n- *.autodlv3 off* (Matikan)` }, { quoted: m });
    }
};
