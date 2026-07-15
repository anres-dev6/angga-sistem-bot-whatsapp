export default {
    name: 'promote',
    aliases: ['admin', 'jadikanadmin'],
    tags: ['admin'],
    description: 'Jadikan member sebagai admin grup',
    access: {
        owner: false,
        group: true,
        private: false
    },
    run: async (sock, msg, args, { sender, isOwner }) => {
        const from = msg.key.remoteJid;
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;

        try {
            // Check admin permissions of the command caller
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            const isAdmin = participants.find(p => p.id === sender)?.admin;

            if (!isOwner && !isAdmin) {
                return sock.sendMessage(from, { text: '❌ Command ini hanya untuk admin grup!' });
            }

            let targets = [];
            
            // 1. Tag/Mention
            if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
                targets = msg.message.extendedTextMessage.contextInfo.mentionedJid;
            } 
            // 2. Reply message
            else if (quotedMsg?.participant) {
                targets.push(quotedMsg.participant);
            } 
            // 3. Raw arguments (numbers/ids)
            else if (args[0]) {
                targets.push(args[0].replace(/\D/g, '') + '@s.whatsapp.net');
            } else {
                return sock.sendMessage(from, { text: '❌ Cara pakai:\n1. Tag member: .promote @member\n2. Reply pesan member dengan .promote' });
            }

            const results = [];
            for (const jid of targets) {
                try {
                    await sock.groupParticipantsUpdate(from, [jid], 'promote');
                    const num = jid.split('@')[0];
                    results.push(`✅ @${num}`);
                } catch (err) {
                    const num = jid.split('@')[0];
                    results.push(`❌ @${num} - ${err.message || 'Gagal'}`);
                }
            }

            return sock.sendMessage(from, {
                text: `📊 *Hasil Promote Admin:*\n\n${results.join('\n')}`,
                mentions: targets
            });
        } catch (err) {
            console.error('Promote admin error:', err);
            return sock.sendMessage(from, { text: `❌ Error: ${err.message}` });
        }
    }
};
