export default {
    name: 'del',
    aliases: ['delete', 'hapus'],
    tags: ['admin', 'grup'],
    description: 'Hapus pesan yang di-reply',
    access: {
        owner: false,
        group: true,
        private: false
    },
    run: async (sock, msg, args, { sender, isOwner }) => {
        const from = msg.key.remoteJid;
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;

        if (!quotedMsg?.stanzaId) {
            return sock.sendMessage(from, { text: '❌ Reply pesan yang ingin dihapus.' });
        }

        try {
            // Check admin permissions
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            const isAdmin = participants.find(p => p.id === sender)?.admin;

            if (!isOwner && !isAdmin) {
                return sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk admin!' });
            }

            // Execute delete
            if (sock.deleteMessage) {
                // Uses mock socket deleteMessage for Telegram
                await sock.deleteMessage(from, {
                    id: quotedMsg.stanzaId,
                    fromMe: quotedMsg.participant === sock.user.id
                });
            } else {
                // Fallback to Baileys for WhatsApp
                const rawBotId = sock.user?.id || sock.user?.jid || '';
                const cleanBotNumber = rawBotId.split(':')[0] + '@s.whatsapp.net';
                
                await sock.sendMessage(from, {
                    delete: {
                        remoteJid: from,
                        fromMe: quotedMsg.participant === cleanBotNumber,
                        id: quotedMsg.stanzaId,
                        participant: quotedMsg.participant
                    }
                });
            }
        } catch (err) {
            console.error('Delete message error:', err);
            return sock.sendMessage(from, { text: `❌ Gagal menghapus pesan: ${err.message}` });
        }
    }
};
