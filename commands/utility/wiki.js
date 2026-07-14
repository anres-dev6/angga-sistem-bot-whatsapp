import { searchWikipedia } from '../../utils/wikiHelper.js';

export default {
    name: 'wiki',
    aliases: ['wikipedia', 'searchwiki'],
    tags: ['utility'],
    description: 'Cari artikel di Wikipedia Bahasa Indonesia dengan tombol navigasi',
    access: {
        owner: false,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const query = args.join(' ').trim();
        
        if (!query) {
            return sock.sendMessage(from, {
                text: '❌ *Format Salah!*\n\nGunakan: `.wiki [kata kunci]`\nContoh: `.wiki kucing`'
            }, { quoted: msg });
        }
        
        try {
            await searchWikipedia(sock, from, query, 0);
        } catch (err) {
            console.error('[Wiki Command] Error:', err);
            return sock.sendMessage(from, {
                text: `❌ *Gagal melakukan pencarian!*\n\n⚠️ Error: ${err.message || err}`
            }, { quoted: msg });
        }
    }
};
