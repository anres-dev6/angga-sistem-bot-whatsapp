import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, '../data/antidelete.json');

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

export function enableAntiDelete(jid) {
    const state = loadState();
    state[jid] = true;
    saveState(state);
    console.log(`[AntiDelete] Enabled for ${jid}`);
}

export function disableAntiDelete(jid) {
    const state = loadState();
    state[jid] = false;
    saveState(state);
    console.log(`[AntiDelete] Disabled for ${jid}`);
}

export function isAntiDeleteEnabled(jid) {
    const state = loadState();
    return state[jid] === true;
}

// ============================================================
//  IN-MEMORY MESSAGE CACHE
//  Menyimpan pesan sebelum dihapus agar bisa di-forward
// ============================================================

if (!global.adMsgCache) {
    global.adMsgCache = new Map();
}

const MAX_CACHE = 500;     // Maksimal pesan yang disimpan
const TTL_MS    = 3600000; // Expire setelah 1 jam

/**
 * Simpan metadata pesan ke cache (dipanggil dari messages.upsert)
 */
export function adCacheMessage(m) {
    try {
        if (m.message?.protocolMessage) return; // Skip protocol messages
        if (!m.key?.id || !m.key?.remoteJid) return;

        // Hanya cache kalau antidelete aktif di chat ini
        if (!isAntiDeleteEnabled(m.key.remoteJid)) return;

        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const sender  = isGroup
            ? (m.key.participant || m.participant || m.key.remoteJid)
            : m.key.remoteJid;

        // Unwrap viewOnce / ephemeral
        let msgContent = m.message;
        if (msgContent?.viewOnceMessage?.message)            msgContent = msgContent.viewOnceMessage.message;
        if (msgContent?.viewOnceMessageV2?.message)          msgContent = msgContent.viewOnceMessageV2.message;
        if (msgContent?.ephemeralMessage?.message)           msgContent = msgContent.ephemeralMessage.message;
        if (msgContent?.documentWithCaptionMessage?.message) msgContent = msgContent.documentWithCaptionMessage.message;

        const text = msgContent?.conversation
            || msgContent?.extendedTextMessage?.text
            || msgContent?.imageMessage?.caption
            || msgContent?.videoMessage?.caption
            || msgContent?.documentMessage?.caption
            || '';

        let mediaType = 'text';
        if (msgContent?.imageMessage)    mediaType = 'image';
        else if (msgContent?.videoMessage)    mediaType = 'video';
        else if (msgContent?.audioMessage)    mediaType = 'audio';
        else if (msgContent?.stickerMessage)  mediaType = 'sticker';
        else if (msgContent?.documentMessage) mediaType = 'document';

        global.adMsgCache.set(m.key.id, {
            id:        m.key.id,
            from:      m.key.remoteJid,
            sender,
            text,
            mediaType,
            msgContent,
            rawMsg:    m,
            cachedAt:  Date.now()
        });

        // Jaga ukuran cache
        if (global.adMsgCache.size > MAX_CACHE) {
            const oldestKey = global.adMsgCache.keys().next().value;
            global.adMsgCache.delete(oldestKey);
        }

        // Auto-expire setelah 1 jam
        setTimeout(() => global.adMsgCache.delete(m.key.id), TTL_MS);

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

        if (!isAntiDeleteEnabled(from)) return;

        console.log(`[AntiDelete] Revoke detected in ${from}, msgId: ${targetMsgId}`);

        const cached = global.adMsgCache.get(targetMsgId);
        if (!cached) {
            console.log('[AntiDelete] Message not in cache, skipping.');
            return;
        }

        const isGroup       = from.endsWith('@g.us');
        const deleter       = m.key.participant || m.participant || (isGroup ? null : m.key.remoteJid);
        const senderNumber  = cached.sender?.split('@')[0]?.split(':')[0] || '?';
        const deleterNumber = deleter?.split('@')[0]?.split(':')[0] || senderNumber;

        // Tentukan JID tujuan
        let targets = [];
        if (target === 'self') {
            // Kirim ke nomor bot sendiri — hanya kamu yang bisa lihat
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

                // Forward media jika ada
                const mc = cached.msgContent;
                if (mc?.imageMessage) {
                    await sock.sendMessage(targetJid, {
                        image: { url: mc.imageMessage.url },
                        caption: mc.imageMessage.caption || ''
                    });
                } else if (mc?.videoMessage) {
                    await sock.sendMessage(targetJid, {
                        video: { url: mc.videoMessage.url },
                        caption: mc.videoMessage.caption || ''
                    });
                } else if (mc?.audioMessage) {
                    await sock.sendMessage(targetJid, {
                        audio: { url: mc.audioMessage.url },
                        ptt: mc.audioMessage.ptt || false
                    }).catch(() => {});
                } else if (mc?.stickerMessage) {
                    await sock.sendMessage(targetJid, {
                        sticker: { url: mc.stickerMessage.url }
                    }).catch(() => {});
                } else if (mc?.documentMessage) {
                    await sock.sendMessage(targetJid, {
                        document: { url: mc.documentMessage.url },
                        mimetype: mc.documentMessage.mimetype,
                        fileName: mc.documentMessage.fileName || 'file'
                    }).catch(() => {});
                }
            } catch (sendErr) {
                console.error('[AntiDelete] Failed to send to', targetJid, ':', sendErr.message);
            }
        }

        global.adMsgCache.delete(targetMsgId);

    } catch (e) {
        console.error('[AntiDelete] adHandleRevoke error:', e.message);
    }
}
