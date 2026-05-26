import { downloadMediaMessage } from "baileys";

export default {
    name: 'rvo',
    tags: ['tools'],
    aliases: ['readviewonce', 'viewonce', 'read', 'vo'],
    description: 'Buka pesan view once (foto/video)',
    access: {
        owner: true,
        group: false,
        private: false
    },
    run: async (sock, msg, args, { isOwner }) => {
        const from = msg.key.remoteJid;
        const m = msg;

        // Permission check
        if (!isOwner) return m.reply("❌ Command ini hanya untuk owner bot.");

        try {
            // 1. Get Quoted Message
            const quotedMsg = m.message?.extendedTextMessage?.contextInfo;
            if (!quotedMsg?.quotedMessage) {
                return sock.sendMessage(from, { text: "❌ Reply gambar/video View Once yang ingin Anda lihat" }, { quoted: m });
            }

            const quoted = quotedMsg.quotedMessage;

            // 2. Enhanced Detection with Multiple Strategies
            let viewOnceMsg = null;
            let detectionMethod = null;

            // Strategy 1: Standard wrappers
            viewOnceMsg = quoted.viewOnceMessage?.message ||
                quoted.viewOnceMessageV2?.message ||
                quoted.viewOnceMessageV2Extension?.message;

            if (viewOnceMsg) {
                detectionMethod = 'wrapper';
                console.log('[RVO] Detection: Standard wrapper');
            }

            // Strategy 2: Ephemeral message wrapper
            if (!viewOnceMsg && quoted.ephemeralMessage?.message) {
                const ephemeral = quoted.ephemeralMessage.message;
                if (ephemeral.viewOnceMessage || ephemeral.viewOnceMessageV2 || ephemeral.viewOnceMessageV2Extension) {
                    viewOnceMsg = ephemeral.viewOnceMessage?.message ||
                        ephemeral.viewOnceMessageV2?.message ||
                        ephemeral.viewOnceMessageV2Extension?.message;
                    detectionMethod = 'ephemeral-wrapper';
                    console.log('[RVO] Detection: Ephemeral wrapper');
                }
            }

            // Strategy 3: Direct viewOnce property
            if (!viewOnceMsg) {
                const messageKeys = Object.keys(quoted);
                for (const key of messageKeys) {
                    if (key.endsWith('Message') && quoted[key]?.viewOnce) {
                        console.log('[RVO] Detection: viewOnce property on:', key);
                        viewOnceMsg = { [key]: quoted[key] };
                        detectionMethod = 'viewOnce-property';
                        break;
                    }
                }
            }

            // Strategy 4: Check messageContextInfo
            if (!viewOnceMsg && quoted.messageContextInfo) {
                console.log('[RVO] Checking messageContextInfo...');
                // Sometimes view once metadata is here
            }

            if (!viewOnceMsg) {
                console.log('[RVO] Detection FAILED - Message structure:', JSON.stringify(Object.keys(quoted)));
                return sock.sendMessage(from, {
                    text: "❌ Ini bukan pesan view-once atau format tidak didukung.\n\n💡 Pastikan Anda reply langsung ke pesan view once."
                }, { quoted: m });
            }

            console.log(`[RVO] Detection successful: ${detectionMethod}`);

            // 3. Extract Media Type
            let mediaType = null;
            let mediaMessage = null;

            if (viewOnceMsg.imageMessage) {
                mediaType = 'image';
                mediaMessage = viewOnceMsg.imageMessage;
            } else if (viewOnceMsg.videoMessage) {
                mediaType = 'video';
                mediaMessage = viewOnceMsg.videoMessage;
            } else {
                console.log('[RVO] No image/video in viewOnceMsg:', Object.keys(viewOnceMsg));
                return sock.sendMessage(from, { text: "❌ Media View Once tidak didukung atau kosong." }, { quoted: m });
            }

            if (!mediaMessage.mediaKey) {
                return sock.sendMessage(from, { text: "❌ Error: Media key tidak ditemukan (Media sudah expired atau corrupt)." }, { quoted: m });
            }

            console.log(`[RVO] Media type: ${mediaType}`);

            // 4. Download Media with Multiple Strategies
            let buffer = null;
            let downloadError = null;
            let successStrategy = null;

            // Strategy 1: Use original quoted message
            try {
                console.log('[RVO] Download Strategy 1: Original quoted');
                buffer = await downloadMediaMessage(
                    {
                        key: {
                            remoteJid: quotedMsg.participant || from,
                            fromMe: false,
                            id: quotedMsg.stanzaId
                        },
                        message: quoted
                    },
                    "buffer",
                    {},
                    {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
                successStrategy = 'original-quoted';
            } catch (e1) {
                downloadError = e1;
                console.log('[RVO] Strategy 1 failed:', e1.message);
            }

            // Strategy 2: Use wrapper if exists
            if (!buffer && isViewOnceWrapper(quoted)) {
                try {
                    console.log('[RVO] Download Strategy 2: Wrapper reconstruction');
                    buffer = await downloadMediaMessage(
                        {
                            key: {
                                remoteJid: quotedMsg.participant || from,
                                fromMe: false,
                                id: quotedMsg.stanzaId
                            },
                            message: { viewOnceMessageV2: { message: viewOnceMsg } }
                        },
                        "buffer",
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );
                    successStrategy = 'wrapper-reconstruction';
                } catch (e2) {
                    downloadError = e2;
                    console.log('[RVO] Strategy 2 failed:', e2.message);
                }
            }

            // Strategy 3: Direct media message
            if (!buffer) {
                try {
                    console.log('[RVO] Download Strategy 3: Direct media');
                    buffer = await downloadMediaMessage(
                        {
                            key: {
                                remoteJid: quotedMsg.participant || from,
                                fromMe: false,
                                id: quotedMsg.stanzaId
                            },
                            message: viewOnceMsg
                        },
                        "buffer",
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );
                    successStrategy = 'direct-media';
                } catch (e3) {
                    downloadError = e3;
                    console.log('[RVO] Strategy 3 failed:', e3.message);
                }
            }

            if (!buffer) {
                console.error('[RVO] All download strategies failed');
                return sock.sendMessage(from, {
                    text: `❌ Gagal mendownload media view once.\n\n⚠️ Error: ${downloadError?.message || 'Unknown'}\n\n💡 Media mungkin sudah expired atau tidak bisa diakses.`
                }, { quoted: m });
            }

            console.log(`[RVO] Download successful via: ${successStrategy}`);

            // 5. Send Media
            const caption = `🔓 *VIEW ONCE OPENED*\n\n` +
                `📝 Caption: ${mediaMessage.caption || '-'}\n` +
                `🔍 Detection: ${detectionMethod}\n` +
                `📥 Download: ${successStrategy}\n` +
                `📊 Type: ${mediaType}`;

            if (mediaType === 'image') {
                await sock.sendMessage(from, { image: buffer, caption: caption }, { quoted: m });
            } else if (mediaType === 'video') {
                await sock.sendMessage(from, { video: buffer, caption: caption }, { quoted: m });
            }

            console.log('[RVO] Successfully sent view once media');

        } catch (e) {
            console.error('[RVO] Unexpected error:', e);
            sock.sendMessage(from, { text: `❌ Error: ${e.message}\n\n💡 Coba lagi atau hubungi owner jika masalah berlanjut.` }, { quoted: m });
        }
    }
};

// Helper to check if it's a wrapper (for logic clarity)
function isViewOnceWrapper(msg) {
    return msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension;
}
