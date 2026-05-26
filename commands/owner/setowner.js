import { loadOwners, addOwner, saveOwners } from '../../utils/security.js';

export default {
    name: 'setowner',
    aliases: ['setowner', 'claimowner'],
    tags: ['owner'],
    description: 'Set yourself as bot owner (first time only)',
    access: {
        owner: false, // Anyone can try, but only works if no owners exist
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0].replace(/\D/g, '');

        try {
            const owners = loadOwners();

            // If owners already exist, deny
            if (owners.length > 0) {
                return sock.sendMessage(from, {
                    text: `❌ *Owner sudah ada!*\n\n👤 Total owner: ${owners.length}\n\n💡 Hanya owner yang bisa tambah owner baru dengan .addowner`
                });
            }

            // Set first owner
            addOwner(sender);

            await sock.sendMessage(from, {
                text: `✅ *Kamu sekarang owner bot!*\n\n📱 Nomor: ${senderNumber}\n\n🔐 Command owner sekarang bisa dipakai:\n• .file - File manager\n• .plugin - NPM manager\n• .exec - Terminal\n• .restart - Restart bot\n• .addowner - Tambah owner lain\n• .listowner - Lihat semua owner`
            });

        } catch (error) {
            console.error('[SetOwner] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ Error: ${error.message}`
            });
        }
    }
};
