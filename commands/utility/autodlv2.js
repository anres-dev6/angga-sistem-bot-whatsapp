import { enableAutoDLV2, disableAutoDLV2, isAutoDLV2Enabled } from '../../Lib/autodlv2_manager.js';

export default {
    name: 'autodlv2',
    aliases: ['autodlv2', 'adlv2'],
    tags: ['download'],
    description: 'Toggle AutoDL V2 (ab-downloader) untuk auto download link',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const command = args[0]?.toLowerCase();

        try {
            if (!command || command === 'status') {
                // Show status
                const isEnabled = isAutoDLV2Enabled(from);

                const statusMsg = `📥 *AutoDL V2 Status*\n\n` +
                    `Status: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                    `Engine: ab-downloader\n\n` +
                    `*Supported Platforms:*\n` +
                    `📸 Instagram - Posts, Stories, Reels\n` +
                    `🎵 TikTok - No Watermark\n` +
                    `📘 Facebook - Videos, Posts\n` +
                    `🐦 Twitter - Videos, Images\n` +
                    `🎬 YouTube - Videos, Audio\n` +
                    `📁 MediaFire - Direct Downloads\n` +
                    `🎬 CapCut - Templates\n` +
                    `💾 Google Drive - Public Files\n` +
                    `📌 Pinterest - Images\n\n` +
                    `💡 *Usage:*\n` +
                    `.autodlv2 on  - Enable\n` +
                    `.autodlv2 off - Disable\n\n` +
                    `ℹ️ AutoDL V2 takes priority over AutoDL for supported platforms`;

                return sock.sendMessage(from, { text: statusMsg }, { quoted: msg });
            }

            if (command === 'on' || command === 'enable') {
                enableAutoDLV2(from);

                return sock.sendMessage(from, {
                    text: `✅ *AutoDL V2 Enabled!*\n\n` +
                        `📥 Auto download akan aktif untuk:\n` +
                        `💡 Kirim link langsung untuk auto download!`
                }, { quoted: msg });
            }

            if (command === 'off' || command === 'disable') {
                disableAutoDLV2(from);

                return sock.sendMessage(from, {
                    text: `❌ *AutoDL V2 Disabled!*\n\n` +
                        `Auto download menggunakan ab-downloader telah dimatikan.\n\n` +
                        `💡 AutoDL (yt-dlp) masih bisa aktif jika enabled.`
                }, { quoted: msg });
            }

            // Invalid command
            return sock.sendMessage(from, {
                text: `❌ *Invalid command!*\n\n` +
                    `💡 Usage:\n` +
                    `.autodlv2 on     - Enable AutoDL V2\n` +
                    `.autodlv2 off    - Disable AutoDL V2\n` +
                    `.autodlv2 status - Show status`
            }, { quoted: msg });

        } catch (error) {
            console.error('[AutoDL V2 Command] Error:', error);
            return sock.sendMessage(from, {
                text: `❌ *Error!*\n\n⚠️ ${error.message}`
            }, { quoted: msg });
        }
    }
};
