export default {
    name: 'tagall',
    aliases: ['tagall', 'all', 'everyone', 'tag'],
    tags: ['admin', 'grup'],
    access: {
        owner: false,
        group: true,
        private: false
    },

    run: async (sock, m, args, { text, isGroup, isOwner }) => {
        if (!isGroup) return sock.sendMessage(m.key.remoteJid, { text: "Fitur ini hanya untuk grup!" }, { quoted: m });

        const from = m.key.remoteJid;
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;

        // No Admin Check - Everyone can use it


        const mentionMessage = text || "Halo semuanya!";

        await sock.sendMessage(from, {
            text: mentionMessage,
            mentions: participants.map(a => a.id)
        }, { quoted: m });
    }
};
