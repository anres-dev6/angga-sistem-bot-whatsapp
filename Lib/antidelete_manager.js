import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage } from 'baileys';
import P from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, '../data/antidelete.json');

// Clean up old temp media files on startup
try {
    const tempDir = path.join(process.cwd(), 'temp/antidelete');
    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
            try {
                fs.unlinkSync(path.join(tempDir, file));
            } catch (err) {}
        }
        console.log('[AntiDelete] Cleaned startup temp media files.');
    }
} catch (e) {
    console.error('[AntiDelete] Failed to clear temp folder on startup:', e.message);
}

// ============================================================
//  PERSISTENT STATE MANAGER
// ============================================================

function loadState() {
    try {
        if (fs.existsSync(STORE_PATH)) {
            return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('[AntiDelete] Failed to load state:', e.message);
    }
    return {};
}

function saveState(state) {
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('[AntiDelete] Failed to save state:', e.message);
    }
}

export function enableAntiDelete(botNumber) {
    if (!botNumber) return;
    const state = loadState();
    state[botNumber] = true;
    saveState(state);
    console.log(`[AntiDelete] Enabled for bot +${botNumber}`);
}

export function disableAntiDelete(botNumber) {
    if (!botNumber) return;
    const state = loadState();
    state[botNumber] = false;
    saveState(state);
    console.log(`[AntiDelete] Disabled for bot +${botNumber}`);
}

export function isAntiDeleteEnabled(botNumber) {
    if (!botNumber) return false;
    const state = loadState();
    return state[botNumber] === true;
}

// ============================================================
//  IN-MEMORY MESSAGE CACHE (High Limit & Extended TTL)
//  Menyimpan semua pesan yang lewat untuk dideteksi jika ditarik
// ============================================================

if (!global.adMsgCache) {
    global.adMsgCache = new Map();
}

const MAX_CACHE = 2500;     // Kapasitas cache besar untuk chat yang sangat ramai
const TTL_MS    = 86400000; // Pesan di-cache selama 24 jam (sehari penuh)

// Unwraps the media message from any wrappers and gets the official Baileys type key
function getMediaMessage(message) {
    if (!message) return null;
    let msgContent = message;
    if (msgContent.viewOnceMessage?.message)            msgContent = msgContent.viewOnceMessage.message;
    if (msgContent.viewOnceMessageV2?.message)          msgContent = msgContent.viewOnceMessageV2.message;
    if (msgContent.ephemeralMessage?.message)           msgContent = msgContent.ephemeralMessage.message;
    if (msgContent.documentWithCaptionMessage?.message) msgContent = msgContent.documentWithCaptionMessage.message;

    if (msgContent.imageMessage) return { message: msgContent.imageMessage, type: 'imageMessage' };
    if (msgContent.videoMessage) return { message: msgContent.videoMessage, type: 'videoMessage' };
    if (msgContent.audioMessage) return { message: msgContent.audioMessage, type: 'audioMessage' };
    if (msgContent.stickerMessage) return { message: msgContent.stickerMessage, type: 'stickerMessage' };
    if (msgContent.documentMessage) return { message: msgContent.documentMessage, type: 'documentMessage' };
    return null;
}

// Robust fallback decrypt/downloader for Baileys media messages
async function downloadMediaHelper(sock, m, mediaMsg, mediaType) {
    let buffer;
    
    // Cara 1: Parent message (original raw structure)
    try {
        buffer = await downloadMediaMessage(
            m,
            'buffer',
            {},
            {
                logger: P({ level: "silent" }),
                reuploadRequest: sock.updateMediaMessage
            }
        );
    } catch (e1) {
        // Cara 2: Wrapped in dynamic key object { [mediaType]: mediaMsg }
        try {
            buffer = await downloadMediaMessage(
                {
                    key: m.key,
                    message: { [mediaType]: mediaMsg }
                },
                'buffer',
                {},
                {
                    logger: P({ level: "silent" }),
                    reuploadRequest: sock.updateMediaMessage
                }
            );
        } catch (e2) {
            // Cara 3: Direct media message object as value
            try {
                buffer = await downloadMediaMessage(
                    {
                        key: m.key,
                        message: mediaMsg
                    },
                    'buffer',
                    {},
                    {
                        logger: P({ level: "silent" }),
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
            } catch (e3) {
                console.error('[AntiDelete] Decryption failed on all 3 methods:', e3.message);
            }
        }
    }
    return buffer;
}

/**
 * Simpan metadata pesan ke cache (dipanggil dari messages.upsert)
 */
export async function adCacheMessage(sock, m) {
    try {
        // Hanya skip jika ini adalah protocolMessage REVOKE (karena ini pesan penghapusan)
        const protoType = m.message?.protocolMessage?.type;
        if (protoType === 0 || protoType === 'REVOKE') return;
        
        if (!m.key?.id || !m.key?.remoteJid) return;

        // Ambil nomor bot dari socket
        const botNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
        if (!botNumber) return;

        // Hanya cache kalau antidelete aktif untuk bot ini
        if (!isAntiDeleteEnabled(botNumber)) return;

        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const sender  = isGroup
            ? (m.key.participant || m.participant || m.key.remoteJid)
            : m.key.remoteJid;

        // Unwrap wrappers (viewOnce, ephemeral, dll)
        let msgContent = m.message;
        if (msgContent?.viewOnceMessage?.message)            msgContent = msgContent.viewOnceMessage.message;
        if (msgContent?.viewOnceMessageV2?.message)          msgContent = msgContent.viewOnceMessageV2.message;
        if (msgContent?.ephemeralMessage?.message)           msgContent = msgContent.ephemeralMessage.message;
        if (msgContent?.documentWithCaptionMessage?.message) msgContent = msgContent.documentWithCaptionMessage.message;

        // Ekstrak text secara agresif dari tipe apa pun
        let text = msgContent?.conversation
            || msgContent?.extendedTextMessage?.text
            || msgContent?.imageMessage?.caption
            || msgContent?.videoMessage?.caption
            || msgContent?.documentMessage?.caption
            || msgContent?.interactiveMessage?.body?.text
            || msgContent?.templateMessage?.hydratedTemplate?.hydratedContentText
            || msgContent?.buttonsMessage?.contentText
            || '';

        // Deteksi tipe media atau objek khusus
        let mediaType = 'text';
        if (msgContent?.imageMessage)         mediaType = 'image';
        else if (msgContent?.videoMessage)    mediaType = 'video';
        else if (msgContent?.audioMessage)    mediaType = 'audio';
        else if (msgContent?.stickerMessage)  mediaType = 'sticker';
        else if (msgContent?.documentMessage) mediaType = 'document';
        else if (msgContent?.contactMessage)  {
            mediaType = 'contact';
            text = `Nama Kartu Nama: ${msgContent.contactMessage.displayName || '-'}`;
        }
        else if (msgContent?.contactsArrayMessage) {
            mediaType = 'contacts';
            text = `Daftar Kontak: ${(msgContent.contactsArrayMessage.contacts || []).map(c => c.displayName).join(', ')}`;
        }
        else if (msgContent?.locationMessage) {
            mediaType = 'location';
            text = `📍 Lokasi: Lat ${msgContent.locationMessage.degreesLatitude}, Long ${msgContent.locationMessage.degreesLongitude}`;
        }
        else if (msgContent?.pollCreationMessage) {
            mediaType = 'poll';
            text = `📊 Polling: "${msgContent.pollCreationMessage.name}"\nPilihan: ${(msgContent.pollCreationMessage.options || []).map(o => o.optionName).join(', ')}`;
        }

        // Caching media secara offline/lokal jika ada
        const mediaInfo = getMediaMessage(m.message);
        let mediaPath = null;

        if (mediaInfo) {
            try {
                const tempDir = path.join(process.cwd(), 'temp/antidelete');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                const extMap = {
                    imageMessage: 'jpg',
                    videoMessage: 'mp4',
                    audioMessage: 'ogg',
                    stickerMessage: 'webp',
                    documentMessage: mediaInfo.message.mimetype?.split('/')[1]?.split(';')[0] || 'bin'
                };
                const fileExt = extMap[mediaInfo.type] || 'bin';
                const outputFileName = `ad_${m.key.id}_${Date.now()}.${fileExt}`;
                const outputFilePath = path.join(tempDir, outputFileName);

                // Call the robust 3-method decrypt downloader
                const buffer = await downloadMediaHelper(sock, m, mediaInfo.message, mediaInfo.type);

                if (buffer) {
                    fs.writeFileSync(outputFilePath, buffer);
                    mediaPath = outputFilePath;
                }
            } catch (dlErr) {
                console.error('[AntiDelete] Failed to cache media message:', dlErr.message);
            }
        }

        global.adMsgCache.set(m.key.id, {
            id:        m.key.id,
            from:      m.key.remoteJid,
            sender,
            text,
            mediaType,
            mediaPath,
            msgContent,
            rawMsg:    m,
            cachedAt:  Date.now()
        });

        // Hapus entri tertua jika melebihi kapasitas
        if (global.adMsgCache.size > MAX_CACHE) {
            const oldestKey = global.adMsgCache.keys().next().value;
            const oldest = global.adMsgCache.get(oldestKey);
            if (oldest?.mediaPath && fs.existsSync(oldest.mediaPath)) {
                try { fs.unlinkSync(oldest.mediaPath); } catch {}
            }
            global.adMsgCache.delete(oldestKey);
        }

        // Auto-expire setelah 24 jam
        setTimeout(() => {
            const oldest = global.adMsgCache.get(m.key.id);
            if (oldest?.mediaPath && fs.existsSync(oldest.mediaPath)) {
                try { fs.unlinkSync(oldest.mediaPath); } catch {}
            }
            global.adMsgCache.delete(m.key.id);
        }, TTL_MS);

    } catch (e) {
        console.error('[AntiDelete] adCacheMessage error:', e.message);
    }
}

/**
 * Deteksi dan handle pesan yang dihapus (REVOKE)
 * Dipanggil dari messages.upsert
 *
 * @param {object}          sock    - Baileys socket
 * @param {object}          m       - Pesan masuk
 * @param {string[]|'self'} target
 *   - 'self'       → kirim ke nomor bot sendiri (default, hanya kamu yang lihat)
 *   - ['628xxx']   → kirim ke nomor-nomor tertentu
 */
export async function adHandleRevoke(sock, m, target = 'self') {
    try {
        // Deteksi protocolMessage tipe REVOKE (type 0 atau 'REVOKE')
        let proto = m.message?.protocolMessage
            || m.message?.ephemeralMessage?.message?.protocolMessage
            || m.message?.viewOnceMessage?.message?.protocolMessage;

        if (!proto) return;

        const isRevoke = proto.type === 0 || proto.type === 'REVOKE';
        if (!isRevoke) return;

        const targetMsgId = proto.key?.id;
        const from        = m.key.remoteJid;

        // Ambil nomor bot dari socket
        const botNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0];
        if (!botNumber) return;

        // Hanya proses jika anti-delete aktif untuk bot ini
        if (!isAntiDeleteEnabled(botNumber)) return;

        console.log(`[AntiDelete] Revoke detected in ${from}, msgId: ${targetMsgId}`);

        const cached = global.adMsgCache.get(targetMsgId);
        if (!cached) {
            console.log('[AntiDelete] Message not in cache, skipping.');
            return;
        }

        // Status filter: Jika dari status@broadcast, abaikan jika umurnya >= 24 jam
        if (from === 'status@broadcast') {
            const age = Date.now() - cached.cachedAt;
            if (age >= 24 * 60 * 60 * 1000) {
                console.log('[AntiDelete] Status expired (>24h), skipping.');
                return;
            }
        }

        const isGroup       = from.endsWith('@g.us');
        const deleter       = m.key.participant || m.participant || (isGroup ? null : m.key.remoteJid);
        const senderNumber  = cached.sender?.split('@')[0]?.split(':')[0] || '?';
        const deleterNumber = deleter?.split('@')[0]?.split(':')[0] || senderNumber;

        // Tentukan JID tujuan
        let targets = [];
        if (target === 'self') {
            const selfRaw = sock.user?.id;
            const selfNum = selfRaw?.includes(':')
                ? selfRaw.split(':')[0]
                : selfRaw?.split('@')[0];
            if (selfNum) targets = [selfNum + '@s.whatsapp.net'];
        } else if (Array.isArray(target) && target.length > 0) {
            targets = target.map(n => n.includes('@') ? n : n + '@s.whatsapp.net');
        }

        if (targets.length === 0) {
            console.warn('[AntiDelete] No valid target JID, skipping.');
            return;
        }

        const notifText =
            `🔔 *[ANTI-DELETE]*\n\n` +
            `📍 *Dari:* ${cached.from}\n` +
            `👤 *Pengirim:* @${senderNumber}\n` +
            `🗑️ *Penghapus:* @${deleterNumber}` +
            (cached.text ? `\n\n💬 *Pesan:*\n${cached.text}` : `\n📎 *Tipe:* ${cached.mediaType}`);

        const mentions = [];
        if (cached.sender) mentions.push(cached.sender);
        if (deleter && deleter !== cached.sender) mentions.push(deleter);

        for (const targetJid of targets) {
            try {
                await sock.sendMessage(targetJid, { text: notifText, mentions });

                // Forward media jika ada file path yang valid
                if (cached.mediaPath && fs.existsSync(cached.mediaPath)) {
                    const mediaBuffer = fs.readFileSync(cached.mediaPath);
                    const mc = cached.msgContent;

                    if (cached.mediaType === 'image') {
                        await sock.sendMessage(targetJid, {
                            image: mediaBuffer,
                            caption: mc?.imageMessage?.caption || ''
                        });
                    } else if (cached.mediaType === 'video') {
                        await sock.sendMessage(targetJid, {
                            video: mediaBuffer,
                            caption: mc?.videoMessage?.caption || ''
                        });
                    } else if (cached.mediaType === 'audio') {
                        await sock.sendMessage(targetJid, {
                            audio: mediaBuffer,
                            ptt: mc?.audioMessage?.ptt || false,
                            mimetype: mc?.audioMessage?.mimetype || 'audio/ogg; codecs=opus'
                        });
                    } else if (cached.mediaType === 'sticker') {
                        await sock.sendMessage(targetJid, {
                            sticker: mediaBuffer
                        });
                    } else if (cached.mediaType === 'document') {
                        await sock.sendMessage(targetJid, {
                            document: mediaBuffer,
                            mimetype: mc?.documentMessage?.mimetype || 'application/octet-stream',
                            fileName: mc?.documentMessage?.fileName || 'document'
                        });
                    }
                }
            } catch (sendErr) {
                console.error('[AntiDelete] Failed to send to', targetJid, ':', sendErr.message);
            }
        }

    } catch (e) {
        console.error('[AntiDelete] adHandleRevoke error:', e.message);
    }
}
