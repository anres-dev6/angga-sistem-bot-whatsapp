import { downloadMediaMessage } from "baileys";

// Ordered list of WhatsApp media message types to check (layered check)
const TARGET_MEDIA_TYPES = [
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'ephemeralMessage',
    'imageMessage',
    'videoMessage',
    'documentMessage',
    'stickerMessage'
];

/**
 * Deep recursive scanner to search and extract media messages within a WhatsApp message tree.
 * Supports Android/iOS structures, forwarded wrappers, story/status contents, and custom clients.
 *
 * @param {object} obj - Nested message object to inspect
 * @param {string} path - Logging traversal path track
 * @returns {object|null} Matched media details containing type, parsed message object, and path taken
 */
function findMediaMessage(obj, path = 'quoted') {
    if (!obj || typeof obj !== 'object') return null;

    // 1. Precedence check on current object layer
    for (const type of TARGET_MEDIA_TYPES) {
        if (obj[type]) {
            const nested = obj[type];
            const currentPath = `${path} -> ${type}`;
            console.log(`[RVO Log] Detected media wrapper/target of type "${type}" at path: "${currentPath}"`);

            // If it is a wrapper format, recurse into its message contents
            if (['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'ephemeralMessage'].includes(type)) {
                const subMsg = nested.message || nested;
                const result = findMediaMessage(subMsg, currentPath);
                if (result) return result;
            } else {
                // It is a direct media block. Check if download credentials exist.
                if (nested.mediaKey || nested.directPath || nested.url) {
                    return {
                        type,
                        message: nested,
                        path: currentPath
                    };
                } else {
                    console.log(`[RVO Log] Found "${type}" but it is missing binary download credentials (expired or corrupt).`);
                }
            }
        }
    }

    // 2. Deep recursive fallback search (handles status/stories, forwards, contextInfo nesting)
    for (const key of Object.keys(obj)) {
        // Skip contextInfo to prevent infinite circular loops or quoting backtracking
        if (obj[key] && typeof obj[key] === 'object' && key !== 'contextInfo') {
            const result = findMediaMessage(obj[key], `${path} -> ${key}`);
            if (result) return result;
        }
    }

    return null;
}

export default {
    name: 'rvo',
    tags: ['tools'],
    aliases: ['readviewonce', 'viewonce', 'read', 'vo'],
    description: 'Buka pesan view once (foto/video/audio/sticker/document)',
    access: {
        owner: true,
        group: false,
        private: false
    },
    run: async (sock, msg, args, { isOwner }) => {
        const from = msg.key.remoteJid;
        const m = msg;

        // Owner security validation
        if (!isOwner) return m.reply("❌ Command ini hanya untuk owner bot.");

        try {
            // 1. Get Quoted/Replied Message Context
            const quotedContext = m.message?.extendedTextMessage?.contextInfo;
            if (!quotedContext || !quotedContext.quotedMessage) {
                return sock.sendMessage(from, { 
                    text: "❌ Reply media View Once (foto, video, audio, sticker, atau document) yang ingin Anda buka dengan mengetik *.rvo*" 
                }, { quoted: m });
            }

            const quotedMessage = quotedContext.quotedMessage;
            console.log(`[RVO Command] Processing message. Type: ${Object.keys(quotedMessage).join(', ')}`);

            // 2. Perform deep layered media search
            const resolved = findMediaMessage(quotedMessage);

            if (!resolved) {
                console.log(`[RVO Command] Search complete. No supported media structures found.`);
                return sock.sendMessage(from, {
                    text: `❌ Media tidak dapat diakses.\n\n` +
                          `Kemungkinan penyebab:\n` +
                          `• Pesan sudah terlalu lama atau expired.\n` +
                          `• Media telah dihapus oleh pengirim.\n` +
                          `• WhatsApp tidak lagi menyediakan media tersebut.\n` +
                          `• Format media tidak didukung.\n\n` +
                          `Silakan minta pengirim mengirim ulang media tersebut.`
                }, { quoted: m });
            }

            const mediaType = resolved.type;
            const mediaMessage = resolved.message;
            const mimeType = mediaMessage.mimetype || 'unknown';

            console.log(`[RVO Command] Found media target. Type: ${mediaType}, Path: ${resolved.path}, Mimetype: ${mimeType}`);
            await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

            // 3. Sequential Multi-Tier Downloading Fallback
            let buffer = null;
            let downloadError = null;

            // Strategy 1: Reconstructed single-wrapper message
            try {
                console.log(`[RVO Downloader] Strategy 1: Reconstructed wrapper using type "${mediaType}"`);
                buffer = await downloadMediaMessage(
                    {
                        key: {
                            remoteJid: quotedContext.participant || from,
                            fromMe: false,
                            id: quotedContext.stanzaId
                        },
                        message: { [mediaType]: mediaMessage }
                    },
                    "buffer",
                    {},
                    {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
            } catch (err1) {
                downloadError = err1;
                console.log(`[RVO Downloader] Strategy 1 failed:`, err1.message);
            }

            // Strategy 2: Direct media block as root envelope
            if (!buffer) {
                try {
                    console.log(`[RVO Downloader] Strategy 2: Direct media block`);
                    buffer = await downloadMediaMessage(
                        {
                            key: {
                                remoteJid: quotedContext.participant || from,
                                fromMe: false,
                                id: quotedContext.stanzaId
                            },
                            message: mediaMessage
                        },
                        "buffer",
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );
                } catch (err2) {
                    downloadError = err2;
                    console.log(`[RVO Downloader] Strategy 2 failed:`, err2.message);
                }
            }

            // Strategy 3: Original quoted envelope structure
            if (!buffer) {
                try {
                    console.log(`[RVO Downloader] Strategy 3: Full original quoted message envelope`);
                    buffer = await downloadMediaMessage(
                        {
                            key: {
                                remoteJid: quotedContext.participant || from,
                                fromMe: false,
                                id: quotedContext.stanzaId
                            },
                            message: quotedMessage
                        },
                        "buffer",
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );
                } catch (err3) {
                    downloadError = err3;
                    console.log(`[RVO Downloader] Strategy 3 failed:`, err3.message);
                }
            }

            // Check if download failed on all tiers
            if (!buffer) {
                console.error(`[RVO Downloader] All downloading fallbacks failed. Last Error:`, downloadError);
                await sock.sendMessage(from, { react: { text: '❌', key: m.key } });
                return sock.sendMessage(from, {
                    text: `❌ Media tidak dapat diakses.\n\n` +
                          `Kemungkinan penyebab:\n` +
                          `• Pesan sudah terlalu lama atau expired.\n` +
                          `• Media telah dihapus oleh pengirim.\n` +
                          `• WhatsApp tidak lagi menyediakan media tersebut.\n` +
                          `• Format media tidak didukung.\n\n` +
                          `Silakan minta pengirim mengirim ulang media tersebut.`
                }, { quoted: m });
            }

            console.log(`[RVO Downloader] Download successful! Buffer size: ${buffer.length} bytes.`);

            // 4. Send Opened Media depending on resolved MIME category
            const caption = `🔓 *VIEW ONCE OPENED SUCCESSFULLY*\n\n` +
                            `📂 *Path:* \`${resolved.path}\`\n` +
                            `📊 *Type:* \`${mediaType}\`\n` +
                            `🏷️ *Mime:* \`${mimeType}\`\n` +
                            `📝 *Caption:* ${mediaMessage.caption || '-'}`;

            if (mimeType.includes('image') || mediaType === 'imageMessage') {
                await sock.sendMessage(from, { image: buffer, caption: caption }, { quoted: m });
            } else if (mimeType.includes('video') || mediaType === 'videoMessage') {
                await sock.sendMessage(from, { video: buffer, caption: caption }, { quoted: m });
            } else if (mimeType.includes('sticker') || mediaType === 'stickerMessage') {
                await sock.sendMessage(from, { sticker: buffer }, { quoted: m });
                await sock.sendMessage(from, { text: caption }, { quoted: m });
            } else if (mimeType.includes('audio')) {
                await sock.sendMessage(from, { audio: buffer, mimetype: mimeType }, { quoted: m });
                await sock.sendMessage(from, { text: caption }, { quoted: m });
            } else {
                // Fallback to sending as standard document/attachment
                const originalName = mediaMessage.fileName || `rvo_file_${Date.now()}.${mimeType.split('/')[1] || 'bin'}`;
                await sock.sendMessage(from, {
                    document: buffer,
                    mimetype: mimeType || 'application/octet-stream',
                    fileName: originalName,
                    caption: caption
                }, { quoted: m });
            }

            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
            console.log(`[RVO Command] Successfully processed and dispatched view once media.`);

        } catch (e) {
            console.error('[RVO Command] Unexpected critical error:', e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: `❌ Media tidak dapat diakses.\n\n` +
                      `Kemungkinan penyebab:\n` +
                      `• Pesan sudah terlalu lama atau expired.\n` +
                      `• Media telah dihapus oleh pengirim.\n` +
                      `• WhatsApp tidak lagi menyediakan media tersebut.\n` +
                      `• Format media tidak didukung.\n\n` +
                      `Silakan minta pengirim mengirim ulang media tersebut.`
            }, { quoted: msg });
        }
    }
};
