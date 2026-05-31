import axios from 'axios';
import { imageToWebp } from '../../Lib/converter.js';
import { addStickerMetadata } from '../../Lib/sticker.js';

export default {
    name: 'emojimix',
    aliases: ['emojimix', 'emix', 'mixemoji', 'mix'],
    tags: ['sticker'],
    description: 'Menggabungkan dua emoji menjadi satu stiker unik',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const text = args.join('');

        // Extract emojis from input
        const emojis = text.match(/[\p{Emoji_Presentation}\p{Emoji_Modifier_Base}]/gu) || [];

        if (emojis.length < 2) {
            return sock.sendMessage(from, { 
                text: '❌ Silakan masukkan 2 emoji yang ingin digabungkan.\n\n💡 *Contoh:* \n• *.emojimix 😭+🗿*\n• *.emojimix 😭 🗿*' 
            }, { quoted: msg });
        }

        const emoji1 = emojis[0];
        const emoji2 = emojis[1];

        try {
            // Send processing reaction
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            let response;
            let success = false;

            // Strategy 1: Try emoji1 + emoji2 order
            try {
                console.log(`[EmojiMix] Fetching ${emoji1}_${emoji2}...`);
                response = await axios.get(`https://emojik.vercel.app/s/${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}?size=512`, {
                    responseType: 'arraybuffer',
                    timeout: 10000
                });
                success = true;
            } catch (e1) {
                console.warn(`[EmojiMix] Order ${emoji1}_${emoji2} failed, trying reverse...`);
            }

            // Strategy 2: Try emoji2 + emoji1 order (Reverse fallback)
            if (!success) {
                try {
                    console.log(`[EmojiMix] Fetching ${emoji2}_${emoji1}...`);
                    response = await axios.get(`https://emojik.vercel.app/s/${encodeURIComponent(emoji2)}_${encodeURIComponent(emoji1)}?size=512`, {
                        responseType: 'arraybuffer',
                        timeout: 10000
                    });
                    success = true;
                } catch (e2) {
                    console.warn(`[EmojiMix] Order ${emoji2}_${emoji1} failed as well.`);
                }
            }

            if (!success || !response || response.status !== 200) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(from, { 
                    text: `❌ Kombinasi emoji *${emoji1} + ${emoji2}* tidak tersedia di Emoji Kitchen.` 
                }, { quoted: msg });
            }

            const imgBuffer = Buffer.from(response.data);

            // Convert to high-quality WebP sticker
            const webpBuffer = await imageToWebp(imgBuffer);

            // Inject custom sticker metadata
            const finalSticker = await addStickerMetadata(webpBuffer, 'ANRES-DEV6', 'Made With ANRES');

            // Send combined emoji sticker
            await sock.sendMessage(from, { sticker: finalSticker }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[EmojiMix Command] Error:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, { 
                text: `❌ Gagal menggabungkan emoji: ${error.message}` 
            }, { quoted: msg });
        }
    }
};
