import { setAutoDL, isAutoDLEnabled } from '../../Lib/autodl_manager.js';

export default {
    name: 'autodl',
    tags: ['tools'],
    description: 'Turn on/off valid link auto-download',
    access: {
        owner: false,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const state = args[0]?.toLowerCase();

        if (state === 'on') {
            setAutoDL(from, true);
            return sock.sendMessage(from, { text: "✅ Auto Downloader ON!\n\nBot akan memproses link yang kalian berikan." }, { quoted: msg });
        } else if (state === 'off') {
            setAutoDL(from, false);
            return sock.sendMessage(from, { text: "❌ Auto Downloader OFF." }, { quoted: msg });
        } else {
            const status = isAutoDLEnabled(from) ? 'ON' : 'OFF';
            return sock.sendMessage(from, { text: `Status AutoDL: *${status}*\n\nGunakan command: .autodl on / .autodl off` }, { quoted: msg });
        }
    }
}
