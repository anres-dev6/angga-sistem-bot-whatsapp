import { findSessionByUser, terminateConfessSession } from '../../Lib/confess_manager.js';

export default {
    name: 'confessstop',
    aliases: ['confessstop', 'stopconfess', 'menfessstop', 'stopmenfess'],
    tags: ['tools'],
    description: 'Menghentikan sesi menfess/confess aktif secara manual',
    access: {
        owner: false,
        group: false,
        private: true
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (isGroup) {
            return sock.sendMessage(from, {
                text: "❌ Perintah ini hanya dapat digunakan di Private Chat (Chat Pribadi dengan Bot)."
            }, { quoted: msg });
        }

        const senderJid = from;

        // Check if this user is in an active session
        const session = findSessionByUser(senderJid);
        if (!session) {
            return sock.sendMessage(from, {
                text: "❌ Anda sedang tidak berada dalam sesi menfess/confess aktif."
            }, { quoted: msg });
        }

        try {
            // Terminate manually
            await terminateConfessSession(sock, session, true);
        } catch (error) {
            return sock.sendMessage(from, {
                text: `❌ Gagal menutup sesi menfess/confess: ${error.message}`
            }, { quoted: msg });
        }
    }
};
