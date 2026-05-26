import config from '../config.js';
import { isOwner, logActivity } from '../utils/security.js';

export default {
    name: 'restart',
    aliases: ['restart', 'reboot', 'r'],
    tags: ['owner'],
    description: 'Restart bot server',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        // Owner check - TEMPORARILY DISABLED FOR DEBUGGING
        // if (!isOwner(sender, config)) {
        //     return sock.sendMessage(from, {
        //         text: "❌ Owner-only command!"
        //     });
        // }

        console.log('[RESTART] User:', sender);

        try {
            await sock.sendMessage(from, {
                text: "🔄 Restarting bot..."
            });

            logActivity(sender, 'restart bot', 'Initiated');

            // Simple exit - PM2 will auto-restart
            setTimeout(() => {
                console.log('[Restart] Bot restarting by owner command...');
                process.exit(0);
            }, 1000);

        } catch (error) {
            console.error('[Restart] Error:', error);
            logActivity(sender, 'restart bot', 'Error', error.message);

            return sock.sendMessage(from, {
                text: `❌ Error: ${error.message}`
            });
        }
    }
};
