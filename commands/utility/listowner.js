import { loadOwners, isOwner } from '../../utils/security.js';

export default {
    name: 'listowner',
    aliases: ['listowner', 'owners'],
    tags: ['info'],
    description: 'List all bot owners',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            const owners = loadOwners();

            if (owners.length === 0) {
                return sock.sendMessage(from, {
                    text: `📋 *DAFTAR OWNER*\n\n❌ Belum ada owner!\n\n💡 Gunakan .setowner untuk claim owner pertama kali`
                });
            }

            let text = `📋 *DAFTAR OWNER*\n\n`;

            owners.forEach((number, index) => {
                text += `${index + 1}. wa.me/${number}\n`;
            });

            text += `\n👥 Total: ${owners.length} owner`;

            await sock.sendMessage(from, { text });

        } catch (error) {
            console.error('[ListOwner] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ Error: ${error.message}`
            });
        }
    }
};
