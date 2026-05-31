import { findSessionByUser, terminateConfessSession } from '../../Lib/confess_manager.js';

export default {
    name: 'confessstop',
    aliases: ['confessstop', 'stopconfess'],
    tags: ['tools'],
    description: 'Menghentikan sesi confess aktif secara manual',
    access: {
        owner: false,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const senderJid = msg.key.participant || msg.participant || from;

        // Check if this user is in an active session
        const session = findSessionByUser(senderJid);
        if (!session) {
            return sock.sendMessage(from, {
                text: "❌ Anda sedang tidak berada dalam sesi confess aktif."
            }, { quoted: msg });
        }

        try {
            // Terminate manually
            await terminateConfessSession(sock, session, true);
        } catch (error) {
            return sock.sendMessage(from, {
                text: `❌ Gagal menutup sesi confess: ${error.message}`
            }, { quoted: msg });
        }
    }
};
