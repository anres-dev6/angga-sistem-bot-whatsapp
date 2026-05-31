import { setAutoSticker, isAutoStickerEnabled } from '../../Lib/autosticker_manager.js';

export default {
    name: 'autostiker',
    aliases: ['autostiker', 'autosticker', 'autostk'],
    tags: ['sticker'],
    description: 'Mengaktifkan/mematikan otomatisasi pembuatan stiker dari gambar yang dikirim',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const state = args[0]?.toLowerCase();

        try {
            if (state === 'on' || state === 'enable') {
                setAutoSticker(from, true);
                return sock.sendMessage(from, { 
                    text: "✅ *Auto Sticker ON!*\n\nSetiap gambar yang dikirim langsung di obrolan ini (tanpa command) akan otomatis diubah menjadi stiker WhatsApp berkualitas tinggi." 
                }, { quoted: msg });
            } else if (state === 'off' || state === 'disable') {
                setAutoSticker(from, false);
                return sock.sendMessage(from, { 
                    text: "❌ *Auto Sticker OFF.*\n\nOtomatisasi pembuatan stiker telah dimatikan." 
                }, { quoted: msg });
            } else {
                const status = isAutoStickerEnabled(from) ? '✅ ON' : '❌ OFF';
                return sock.sendMessage(from, { 
                    text: `📊 *Status Auto Sticker:* *${status}*\n\n💡 *Gunakan command:* \n• *.autostiker on* (Mengaktifkan)\n• *.autostiker off* (Mematikan)` 
                }, { quoted: msg });
            }
        } catch (error) {
            console.error('[AutoSticker Command] Error:', error);
            return sock.sendMessage(from, { text: `⚠️ Error: ${error.message}` });
        }
    }
};
