import { downloadMediaMessage, generateWAMessageContent, generateWAMessageFromContent } from "baileys";
import crypto from "crypto";

export default {
    name: 'upsw',
    aliases: ['upsw'],
    tags: ['grup'],
    description: 'Upload status/story ke grup',
    access: {
        owner: false,
        group: true,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) return;

        try {
            // Determine if replying to a media message or if it contains media
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
            const hasQuoted = quotedMsg && quotedMsg.quotedMessage;

            let mediaType = null;
            let mediaBuffer = null;
            let isTextOnly = false;
            let caption = args.join(' ').trim();

            if (hasQuoted) {
                const quoted = quotedMsg.quotedMessage;

                if (quoted.imageMessage) {
                    mediaType = 'image';
                    mediaBuffer = await downloadMediaMessage(
                        { key: { remoteJid: from, id: quotedMsg.stanzaId }, message: quoted },
                        "buffer",
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                } else if (quoted.videoMessage) {
                    mediaType = 'video';
                    mediaBuffer = await downloadMediaMessage(
                        { key: { remoteJid: from, id: quotedMsg.stanzaId }, message: quoted },
                        "buffer",
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                } else if (quoted.audioMessage) {
                    mediaType = 'audio';
                    mediaBuffer = await downloadMediaMessage(
                        { key: { remoteJid: from, id: quotedMsg.stanzaId }, message: quoted },
                        "buffer",
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                } else if (quoted.conversation || quoted.extendedTextMessage) {
                    isTextOnly = true;
                    // If user didn't specify text in .upsw command, take it from quoted text
                    if (!caption) {
                        caption = quoted.conversation || quoted.extendedTextMessage?.text || "";
                    }
                }
            } else if (msg.message?.imageMessage) {
                mediaType = 'image';
                mediaBuffer = await downloadMediaMessage(
                    msg,
                    "buffer",
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
            } else if (msg.message?.videoMessage) {
                mediaType = 'video';
                mediaBuffer = await downloadMediaMessage(
                    msg,
                    "buffer",
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
            } else if (msg.message?.audioMessage) {
                mediaType = 'audio';
                mediaBuffer = await downloadMediaMessage(
                    msg,
                    "buffer",
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
            } else if (caption) {
                isTextOnly = true;
            }

            // If nothing found to upload, react with ❌ and exit silently (no text)
            if (!mediaType && !isTextOnly) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return;
            }

            // Build status payload
            let content = {};
            if (isTextOnly) {
                content = { text: caption };
            } else if (mediaType === 'image') {
                content = { image: mediaBuffer, caption: caption || '' };
            } else if (mediaType === 'video') {
                content = { video: mediaBuffer, caption: caption || '' };
            } else if (mediaType === 'audio') {
                content = {
                    audio: mediaBuffer,
                    mimetype: 'audio/mp4',
                    ptt: true // Voice status
                };
            }

            // 🔑 Generate WA Message Content (RAW)
            const inside = await generateWAMessageContent(content, {
                upload: sock.waUploadToServer
            });

            // 🔑 Generate messageSecret (MANDATORY for status)
            const messageSecret = crypto.randomBytes(32);

            // 🔑 Wrap dengan groupStatusMessageV2
            const statusMessage = {
                groupStatusMessageV2: {
                    message: {
                        ...inside,
                        messageContextInfo: {
                            messageSecret: messageSecret
                        }
                    }
                }
            };

            // 🔑 Generate full message pointing to the group JID (from)
            const finalMessage = generateWAMessageFromContent(from, statusMessage, {
                userJid: sock.user.id,
                quoted: msg
            });

            // 🔑 Relay message directly inside the group chat (from) - NOT status@broadcast!
            await sock.relayMessage(from, finalMessage.message, {
                messageId: finalMessage.key.id
            });

            // React with success emoji (no text response as requested)
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('UPSW Error:', err);
            try {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            } catch {}
        }
    }
};
