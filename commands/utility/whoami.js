export default {
    name: 'whoami',
    aliases: ['whoami', 'me'],
    tags: ['tools'],
    description: 'Show your WhatsApp info for debugging',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        const fullJid = sender;
        const numberWithSymbols = sender.split('@')[0];
        const numberOnly = sender.split('@')[0].replace(/\D/g, '');
        const jidSuffix = sender.split('@')[1];

        const info = `🔍 *DEBUG INFO*

📱 *Full JID:*
${fullJid}

📞 *Number (with symbols):*
${numberWithSymbols}

🔢 *Number (digits only):*
${numberOnly}

🏷️ *JID Suffix:*
${jidSuffix}

💡 *Copy nomor "digits only" ke config.js*
Format: OWNER: ["${numberOnly}"]`;

        await sock.sendMessage(from, { text: info });
    }
};
