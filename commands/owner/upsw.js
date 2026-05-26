import { downloadMediaMessage, generateWAMessageContent, generateWAMessageFromContent } from "baileys";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const statusTrackingPath = path.join(__dirname, '../../Lib/status_tracking.json');

function loadStatusTracking() {
    try {
        if (!fs.existsSync(statusTrackingPath)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(statusTrackingPath));
    } catch (e) {
        console.error('Error loading status tracking:', e);
        return {};
    }
}

function saveStatusTracking(data) {
    const dir = path.dirname(statusTrackingPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(statusTrackingPath, JSON.stringify(data, null, 2));
}

function addStatusToTracking(groupId, messageId, sender, caption) {
    const tracking = loadStatusTracking();
    if (!tracking[groupId]) {
        tracking[groupId] = [];
    }
    tracking[groupId].push({
        messageId: messageId,
        sender: sender,
        caption: caption || '(No caption)',
        timestamp: Date.now()
    });
    saveStatusTracking(tracking);
    return tracking[groupId].length;
}

function getGroupStatuses(groupId, filterExpired = true) {
    const tracking = loadStatusTracking();
    let statuses = tracking[groupId] || [];

    if (filterExpired) {
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        statuses = statuses.filter(status => {
            return (now - status.timestamp) < TWENTY_FOUR_HOURS;
        });

        if (statuses.length !== (tracking[groupId] || []).length) {
            tracking[groupId] = statuses;
            saveStatusTracking(tracking);
        }
    }

    return statuses;
}

function deleteStatusFromTracking(groupId, index) {
    const tracking = loadStatusTracking();
    if (!tracking[groupId] || !tracking[groupId][index]) {
        return null;
    }
    const deleted = tracking[groupId].splice(index, 1)[0];
    saveStatusTracking(tracking);
    return deleted;
}


function cleanupExpiredStatuses() {
    const tracking = loadStatusTracking();
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    let cleaned = false;

    for (const groupId in tracking) {
        const originalLength = tracking[groupId].length;
        tracking[groupId] = tracking[groupId].filter(status => {
            return (now - status.timestamp) < TWENTY_FOUR_HOURS;
        });
        if (tracking[groupId].length !== originalLength) {
            cleaned = true;
        }
    }

    if (cleaned) {
        saveStatusTracking(tracking);
    }
    return cleaned;
}

export default {
    name: 'upsw',
    aliases: ['upsw', 'uploadstatus', 'upstatus', 'delsw', 'deletestatus', 'listsw'],
    tags: ['grup'],
    access: {
        owner: false,
        group: true,
        private: false
    },

    run: async (sock, msg, args, { sender, command }) => {
        const from = msg.key.remoteJid;
        const m = msg;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) {
            return sock.sendMessage(from, {
                text: '❌ Command ini hanya bisa digunakan di grup!'
            }, { quoted: m });
        }

        try {
            // ========== LIST STATUS ==========
            if (command === 'listsw') {
                const statuses = getGroupStatuses(from);

                if (statuses.length === 0) {
                    return sock.sendMessage(from, {
                        text: '📭 Belum ada status yang diupload di grup ini.\n\n💡 Upload status dengan: .upsw [text/media]'
                    }, { quoted: m });
                }

                let listText = '📊 *DAFTAR STATUS GRUP*\n\n';
                statuses.forEach((status, index) => {
                    const time = new Date(status.timestamp).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        dateStyle: 'short',
                        timeStyle: 'short'
                    });
                    listText += `${index + 1}. @${status.sender.split('@')[0]}\n`;
                    listText += `   📝 ${status.caption.substring(0, 30)}${status.caption.length > 30 ? '...' : ''}\n`;
                    listText += `   ⏰ ${time}\n\n`;
                });

                listText += `💡 Hapus status: .delsw [nomor]`;

                return sock.sendMessage(from, {
                    text: listText,
                    mentions: statuses.map(s => s.sender)
                }, { quoted: m });
            }

            // ========== DELETE STATUS ==========
            if (command === 'delsw' || command === 'deletestatus') {
                if (!args[0]) {
                    return sock.sendMessage(from, {
                        text: '❌ Masukkan nomor status yang ingin dihapus!\n\nContoh:\n• .delsw 1\n• .delsw 1, 3, 5\n• .delsw all (Hapus semua)\n\n💡 Lihat daftar: .listsw'
                    }, { quoted: m });
                }

                const metadata = await sock.groupMetadata(from);
                const participants = metadata.participants;
                const isAdmin = participants.find(p => p.id === sender)?.admin;
                const statuses = getGroupStatuses(from);

                let indicesToDelete = [];

                // Handle "all"
                if (args[0].toLowerCase() === 'all') {
                    if (statuses.length === 0) {
                        return sock.sendMessage(from, { text: '❌ Tidak ada status untuk dihapus.' }, { quoted: m });
                    }

                    if (isAdmin) {
                        // Admin can delete ALL
                        indicesToDelete = statuses.map((_, i) => i);
                    } else {
                        // Regular user can only delete THEIR OWN
                        indicesToDelete = statuses
                            .map((s, i) => s.sender === sender ? i : -1)
                            .filter(i => i !== -1);

                        if (indicesToDelete.length === 0) {
                            return sock.sendMessage(from, { text: '❌ Kamu tidak punya status aktif di grup ini.' }, { quoted: m });
                        }
                    }
                } else {
                    // Handle specific numbers (split by comma or space)
                    const input = args.join(' ');
                    const rawNumbers = input.split(/[\s,]+/); // Split by space or comma

                    // Parse and unique
                    const uniqueIndices = new Set();
                    for (const raw of rawNumbers) {
                        const num = parseInt(raw);
                        if (!isNaN(num) && num > 0) {
                            uniqueIndices.add(num - 1); // Convert to 0-based index
                        }
                    }
                    indicesToDelete = Array.from(uniqueIndices);
                }

                // Sort descending critical for splicing accurately
                indicesToDelete.sort((a, b) => b - a);

                if (indicesToDelete.length === 0) {
                    return sock.sendMessage(from, { text: '❌ Nomor tidak valid.' }, { quoted: m });
                }

                let deletedCount = 0;
                let failedCount = 0;

                // Process Deletions
                for (const index of indicesToDelete) {
                    if (index < 0 || index >= statuses.length) {
                        failedCount++;
                        continue;
                    }

                    const statusToDelete = statuses[index]; // Get current state (NOTE: logic requires grabbing fresh if splice modifies array reference? no, helper reloads? wait logic below)
                    // Optimization: We loaded `statuses` once. 
                    // Since we splice the JSON file one by one via `deleteStatusFromTracking`, 
                    // reading it freshly in every iteration is safer BUT slower.
                    // HOWEVER, `deleteStatusFromTracking` modifies the file on disk.
                    // BUT `deleteStatusFromTracking` as implemented takes an INDEX.
                    // If we delete index 5, then index 4 is untouched.
                    // If we delete index 5, then delete index 3... index 3 is still index 3 relative to original if we haven't reloaded?
                    // NO. `deleteStatusFromTracking` loads from file. So if we delete #5, the file shrinks.
                    // So if we planned to delete original #5 and #3.
                    // We sorted DESCENDING: 5, 3.
                    // Delete #5 -> File shrinks. #3 is still at index 3.
                    // Delete #3 -> File shrinks.
                    // Correct! Descending sort allows us to assume lower indices remain valid.

                    // Check permissions
                    const isOwner = statusToDelete.sender === sender;
                    if (!isOwner && !isAdmin) {
                        failedCount++; // Skip if not allowed
                        continue;
                    }

                    // Perform Delete
                    const deleted = deleteStatusFromTracking(from, index);
                    if (deleted) {
                        deletedCount++;
                        // Try delete actual message
                        try {
                            await sock.sendMessage(from, {
                                delete: {
                                    remoteJid: from,
                                    fromMe: true,
                                    id: deleted.messageId
                                }
                            });
                        } catch (e) { }
                    } else {
                        failedCount++;
                    }
                }

                let msgText = `✅ Berhasil menghapus ${deletedCount} status.`;
                if (failedCount > 0) {
                    msgText += `\n❌ Gagal/Skip: ${failedCount} (Salah nomor/bukan milikmu).`;
                }

                // Show remaining count
                const tracking = loadStatusTracking(); // Reload fresh
                const remaining = tracking[from] ? tracking[from].length : 0;
                msgText += `\n📊 Sisa status: ${remaining}`;

                return sock.sendMessage(from, { text: msgText }, { quoted: m });
            }

            // ========== UPLOAD STATUS ==========
            // React with processing emoji
            await sock.sendMessage(from, {
                react: { text: '⏳', key: m.key }
            });

            // Check if replying to a message with media
            const quotedMsg = m.message?.extendedTextMessage?.contextInfo;
            const hasQuoted = quotedMsg && quotedMsg.quotedMessage;

            // Get caption from args
            let caption = args.join(' ');

            // Get sender info
            const metadata = await sock.groupMetadata(from);
            const senderName = metadata.participants.find(p => p.id === sender)?.notify ||
                sender.split('@')[0];

            // Determine media type and content
            let mediaType = null;
            let mediaBuffer = null;
            let isTextOnly = false;
            let content = {};

            if (hasQuoted) {
                const quoted = quotedMsg.quotedMessage;

                if (quoted.imageMessage) {
                    mediaType = 'image';
                    const messageToDownload = {
                        key: {
                            remoteJid: quotedMsg.participant || from,
                            fromMe: false,
                            id: quotedMsg.stanzaId
                        },
                        message: { imageMessage: quoted.imageMessage }
                    };
                    mediaBuffer = await downloadMediaMessage(
                        messageToDownload,
                        "buffer",
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );
                    // Caption only from args, not from original media
                    // Remove .upsw command from caption if present
                    if (caption && caption.toLowerCase().startsWith('.upsw')) {
                        caption = caption.replace(/^\.upsw\s*/i, '').trim();
                    }
                } else if (quoted.videoMessage) {
                    mediaType = 'video';
                    const messageToDownload = {
                        key: {
                            remoteJid: quotedMsg.participant || from,
                            fromMe: false,
                            id: quotedMsg.stanzaId
                        },
                        message: { videoMessage: quoted.videoMessage }
                    };
                    mediaBuffer = await downloadMediaMessage(
                        messageToDownload,
                        "buffer",
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );
                    // Caption only from args, not from original media
                    // Remove .upsw command from caption if present
                    if (caption && caption.toLowerCase().startsWith('.upsw')) {
                        caption = caption.replace(/^\.upsw\s*/i, '').trim();
                    }
                } else if (quoted.audioMessage) {
                    mediaType = 'audio';
                    const messageToDownload = {
                        key: {
                            remoteJid: quotedMsg.participant || from,
                            fromMe: false,
                            id: quotedMsg.stanzaId
                        },
                        message: { audioMessage: quoted.audioMessage }
                    };
                    mediaBuffer = await downloadMediaMessage(
                        messageToDownload,
                        "buffer",
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );
                    // Audio might not have caption, use args caption
                } else if (quoted.conversation || quoted.extendedTextMessage) {
                    isTextOnly = true;
                    caption = quoted.conversation || quoted.extendedTextMessage?.text || caption;
                }
            } else if (m.message?.imageMessage) {
                mediaType = 'image';
                mediaBuffer = await downloadMediaMessage(
                    m,
                    "buffer",
                    {},
                    {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
                // Caption only from args, not from original media
                // Remove .upsw command from caption if present
                if (caption && caption.toLowerCase().startsWith('.upsw')) {
                    caption = caption.replace(/^\.upsw\s*/i, '').trim();
                }
            } else if (m.message?.videoMessage) {
                mediaType = 'video';
                mediaBuffer = await downloadMediaMessage(
                    m,
                    "buffer",
                    {},
                    {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
                // Caption only from args, not from original media
                // Remove .upsw command from caption if present
                if (caption && caption.toLowerCase().startsWith('.upsw')) {
                    caption = caption.replace(/^\.upsw\s*/i, '').trim();
                }
            } else if (m.message?.audioMessage) {
                mediaType = 'audio';
                mediaBuffer = await downloadMediaMessage(
                    m,
                    "buffer",
                    {},
                    {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
                // Audio messages don't have caption, use args caption
            } else if (caption) {
                isTextOnly = true;
            } else {
                await sock.sendMessage(from, {
                    react: { text: '❌', key: m.key }
                });
                return sock.sendMessage(from, {
                    text: `❌ Tidak ada konten untuk diupload!\n\n*Cara pakai:*\n\n📝 *Text Status:*\n.upsw Halo semua!\n\n🖼️ *Photo/Video Status:*\n• Kirim foto/video dengan caption .upsw [caption]\n• Reply foto/video dengan .upsw [caption]\n\n🎵 *Audio Status:*\n• Kirim audio/voice note dengan .upsw\n• Reply audio dengan .upsw\n\n📋 *Lihat Status:*\n.listsw\n\n🗑️ *Hapus Status:*\n.delsw [nomor]`
                }, { quoted: m });
            }

            // Prepare content for status
            if (isTextOnly) {
                content = {
                    text: caption
                };
            } else if (mediaType === 'image') {
                content = {
                    image: mediaBuffer,
                    caption: caption || ''
                };
            } else if (mediaType === 'audio') {
                content = {
                    audio: mediaBuffer,
                    mimetype: 'audio/mp4',
                    ptt: false // Set to true for voice note, false for audio file
                };
            } else if (mediaType === 'video') {
                content = {
                    video: mediaBuffer,
                    caption: caption || ''
                };
            }

            // 🔑 Generate WA Message Content (RAW)
            const inside = await generateWAMessageContent(content, {
                upload: sock.waUploadToServer
            });

            // 🔑 Generate messageSecret (MANDATORY)
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

            // 🔑 Generate full message
            const finalMessage = generateWAMessageFromContent(from, statusMessage, {
                userJid: sock.user.id,
                quoted: m
            });

            // 🔑 Relay message (BUKAN sendMessage!)
            await sock.relayMessage(from, finalMessage.message, {
                messageId: finalMessage.key.id
            });

            // Track the status
            const statusNumber = addStatusToTracking(from, finalMessage.key.id, sender, caption);

            // Success reaction
            await sock.sendMessage(from, {
                react: { text: '✅', key: m.key }
            });

            return sock.sendMessage(from, {
                text: `✅ Status #${statusNumber} dari @${sender.split('@')[0]} berhasil diupload!`,
                mentions: [sender]
            }, { quoted: m });

        } catch (err) {
            console.error('UPSW Error:', err);
            await sock.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return sock.sendMessage(from, {
                text: `❌ Terjadi error: ${err.message}\n\n⚠️ Catatan: Fitur ini experimental dan mungkin tidak work di semua grup/akun.`
            }, { quoted: m });
        }
    }
};
