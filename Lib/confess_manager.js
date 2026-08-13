import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const SESSIONS_FILE = path.join(process.cwd(), 'data', 'confess_sessions.json');

// In-memory sessions store for 2-way Menfess chats
export let sessions = new Map();

// 1 hour in milliseconds
const SESSION_TIMEOUT_MS = 3600000;

// Helper to load sessions from file
function loadSessionsFromDisk() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            const map = new Map();
            for (const [key, value] of Object.entries(parsed)) {
                value.timeoutTimer = null;
                map.set(key, value);
            }
            return map;
        }
    } catch (e) {
        console.error('[Confess] Failed to load sessions from file:', e.message);
    }
    return new Map();
}

// Helper to save sessions to file
function saveSessionsToDisk() {
    try {
        const dir = path.dirname(SESSIONS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const obj = {};
        for (const [key, value] of sessions.entries()) {
            const copy = { ...value, timeoutTimer: null };
            obj[key] = copy;
        }
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
        console.error('[Confess] Failed to save sessions to file:', e.message);
    }
}

// Initialize and schedule timers for all persisted sessions
export async function initConfessSessions(sock) {
    sessions = loadSessionsFromDisk();
    console.log(chalk.cyan(`[Confess] Initializing sessions from disk. Active sessions: ${sessions.size}`));
    for (const session of sessions.values()) {
        const elapsed = Date.now() - session.lastActivity;
        const remaining = SESSION_TIMEOUT_MS - elapsed;
        if (remaining > 0) {
            scheduleTimeout(sock, session, remaining);
        } else {
            console.log(chalk.yellow(`[Confess] Persisted session ID: ${session.id} expired while bot was offline. Terminating...`));
            await terminateConfessSession(sock, session, false);
        }
    }
}

/**
 * Standardize input identity to a valid JID (supports WhatsApp JIDs and Telegram JIDs)
 */
export function normalizeJid(num) {
    if (!num) return '';
    const cleanStr = num.toString().trim();
    
    // If it is a Telegram JID, return as is
    if (cleanStr.endsWith('@telegram.net')) {
        return cleanStr;
    }
    
    let clean = cleanStr;
    if (clean.includes('@')) {
        clean = clean.split('@')[0];
    }
    if (clean.includes(':')) {
        clean = clean.split(':')[0];
    }
    clean = clean.replace(/[^0-9\-]/g, ''); // Allow dash for negative Telegram IDs
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    }
    if (!clean.endsWith('@s.whatsapp.net')) {
        clean = clean + '@s.whatsapp.net';
    }
    return clean;
}

/**
 * Extract clean phone number or Telegram chat ID from JID (normalizes 08xxx to 628xxx)
 */
export function cleanJid(jid) {
    if (!jid) return '';
    let cleanStr = jid.toString().trim();
    if (cleanStr.endsWith('@telegram.net')) {
        return cleanStr.split('@')[0];
    }
    if (cleanStr.includes('@')) {
        cleanStr = cleanStr.split('@')[0];
    }
    if (cleanStr.includes(':')) {
        cleanStr = cleanStr.split(':')[0];
    }
    let digits = cleanStr.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) {
        digits = '62' + digits.slice(1);
    }
    return digits;
}

/**
 * Check if a JID is currently participating in any active menfess session
 */
export function findSessionByUser(jid) {
    if (!jid) return null;
    const targetClean = cleanJid(jid);
    if (!targetClean) return null;

    for (const session of sessions.values()) {
        if (cleanJid(session.senderJid) === targetClean || cleanJid(session.receiverJid) === targetClean) {
            return session;
        }
    }
    return null;
}

/**
 * Universal sender to route confession messages to WhatsApp or Telegram
 */
export async function sendConfessMessage(sock, jid, text) {
    if (!jid) return;
    const cleanStr = jid.toString().trim();
    
    if (cleanStr.endsWith('@telegram.net')) {
        const chatId = cleanStr.split('@')[0];
        if (global.tgBot) {
            await global.tgBot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(err => {
                console.error("[Confess Telegram Router] Failed to send to Telegram:", chatId, err.message);
            });
        } else {
            console.error("[Confess Telegram Router] global.tgBot is not initialized.");
        }
    } else {
        const target = cleanStr.includes('@') ? cleanStr : normalizeJid(cleanStr);
        if (sock) {
            await sock.sendMessage(target, { text });
        } else {
            console.error("[Confess WhatsApp Router] sock is undefined.");
        }
    }
}

/**
 * Helper to verify WhatsApp receiver via onWhatsApp
 */
async function verifyReceiverJid(sock, rawReceiver) {
    let receiverJid = normalizeJid(rawReceiver);

    if (sock && typeof sock.onWhatsApp === 'function' && !rawReceiver.toString().endsWith('@telegram.net')) {
        try {
            const cleanNum = cleanJid(rawReceiver).replace(/\+/g, '');
            const result = await sock.onWhatsApp(cleanNum);
            const onWa = Array.isArray(result) ? result[0] : result;
            if (onWa && onWa.exists && onWa.jid) {
                receiverJid = onWa.jid;
                console.log(`[Confess] Receiver verified via onWhatsApp: ${receiverJid}`);
            } else if (onWa && !onWa.exists) {
                throw new Error(`Nomor tujuan (+${cleanNum}) tidak terdaftar di WhatsApp.`);
            } else {
                console.log(`[Confess] onWhatsApp returned no result, using normalizeJid fallback for: ${cleanNum}`);
            }
        } catch (e) {
            if (e.message.includes('tidak terdaftar')) throw e;
            console.error('[Confess] onWhatsApp check skipped (network error):', e.message);
        }
    }
    return receiverJid;
}

/**
 * Fitur 1: Send one-way anonymous message (Confess)
 */
export async function sendOneWayConfess(sock, senderJid, senderName, rawReceiver, message) {
    const normalizedSender = normalizeJid(senderJid);
    const receiverJid = await verifyReceiverJid(sock, rawReceiver);

    // Safeguard check: sender cannot confess to themselves
    if (cleanJid(normalizedSender) === cleanJid(receiverJid)) {
        throw new Error("Anda tidak bisa mengirim pesan confess ke nomor Anda sendiri.");
    }

    const confessText = `💌 *PESAN CONFESS (ANONIM)*\n\n` +
                        `*Dari :*\n${senderName || 'Pengagum Rahasia'}\n\n` +
                        `*Kepada :*\nPenerima\n\n` +
                        `*Pesan :*\n${message}\n\n` +
                        `━━━━━━━━━━━━\n` +
                        `🔒 _Pesan ini dikirim secara rahasia melalui bot (Satu Arah)._\n` +
                        `━━━━━━━━━━━━`;

    await sendConfessMessage(sock, receiverJid, confessText);
    console.log(chalk.green(`[Confess] One-way message sent from ${normalizedSender} to ${receiverJid}`));
    return { senderJid: normalizedSender, receiverJid };
}

/**
 * Fitur 2: Creates and starts a 2-way interactive anonymous session (Menfess)
 */
export async function createConfessSession(sock, senderJid, senderName, rawReceiver, firstMessage) {
    const normalizedSender = normalizeJid(senderJid);
    const receiverJid = await verifyReceiverJid(sock, rawReceiver);

    // Safeguard check: sender cannot send to themselves
    if (cleanJid(normalizedSender) === cleanJid(receiverJid)) {
        throw new Error("Anda tidak bisa memulai sesi menfess ke nomor Anda sendiri.");
    }

    // Safeguard check: sender or receiver already busy in a session
    const senderActive = findSessionByUser(normalizedSender);
    if (senderActive) {
        throw new Error("Anda sedang berada dalam sesi menfess/confess aktif. Tutup sesi saat ini dengan *.menfessstop* sebelum memulai sesi baru.");
    }

    const receiverActive = findSessionByUser(receiverJid);
    if (receiverActive) {
        throw new Error("Nomor tujuan sedang berada dalam sesi menfess/confess lain saat ini. Silakan coba lagi nanti.");
    }

    const sessionId = `menfess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = {
        id: sessionId,
        senderJid: normalizedSender,
        senderName: senderName || 'Pengagum Rahasia',
        receiverJid,
        lastActivity: Date.now(),
        timeoutTimer: null
    };

    // Store in-memory and disk
    sessions.set(sessionId, session);
    saveSessionsToDisk();

    // Send first message to the receiver anonymously with reply capability notice
    const introMessage = `💌 *PESAN MENFESS BARU*\n\n` +
                          `*Dari :*\n${session.senderName}\n\n` +
                          `*Kepada :*\nPenerima\n\n` +
                          `*Pesan :*\n${firstMessage}\n\n` +
                          `━━━━━━━━━━━━\n` +
                          `📩 _Balas pesan ini langsung di chat pribadi ini untuk membalas ke pengirim secara rahasia._\n` +
                          `⏳ _Sesi akan berakhir otomatis jika tidak ada aktivitas selama 1 jam._\n` +
                          `🔒 _Ketik *.menfessstop* atau *.confessstop* untuk mengakhiri sesi._\n` +
                          `━━━━━━━━━━━━`;

    await sendConfessMessage(sock, receiverJid, introMessage);

    // Initialize 1-hour timeout trigger
    scheduleTimeout(sock, session);

    console.log(chalk.green(`[Menfess] Session successfully created! ID: ${sessionId}, Sender: ${normalizedSender}, Receiver: ${receiverJid}`));
    return session;
}

/**
 * Resets the 1-hour timeout timer due to new chat activity
 */
export function updateSessionActivity(sock, session) {
    session.lastActivity = Date.now();
    
    // Clear existing timer
    if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
    }

    // Re-schedule the 1-hour timer
    scheduleTimeout(sock, session);
    saveSessionsToDisk();
    console.log(`[Confess/Menfess] Timer extended for session ID: ${session.id}`);
}

/**
 * Schedules the inactivity timeout trigger
 */
function scheduleTimeout(sock, session, customTime = null) {
    const timeLimit = customTime !== null ? customTime : SESSION_TIMEOUT_MS;
    session.timeoutTimer = setTimeout(async () => {
        console.log(chalk.yellow(`[Confess/Menfess] Session timeout reached for ID: ${session.id}. Terminating...`));
        await terminateConfessSession(sock, session, false);
    }, timeLimit);
}

/**
 * Terminates the confession session, cleans up data, and deletes bot's receiver chats
 */
export async function terminateConfessSession(sock, session, manualStop = false) {
    // 1. Clear any active timer reference
    if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
        session.timeoutTimer = null;
    }

    // 2. Remove session from in-memory routing map and disk immediately
    sessions.delete(session.id);
    saveSessionsToDisk();

    // 3. Dispatch session termination cards to both parties
    const endMsg = manualStop 
        ? `🔒 *Sesi Menfess/Confess telah ditutup secara manual oleh salah satu pihak.*` 
        : `⏳ *SESI BERAKHIR*\n\nTidak ada aktivitas selama 1 jam.\n\nSesi Menfess/Confess telah ditutup secara otomatis.`;

    await sendConfessMessage(sock, session.senderJid, endMsg);
    await sendConfessMessage(sock, session.receiverJid, endMsg);

    // 4. Secure Cleanups: Clear and delete chat data relating to the receiver (WhatsApp)
    if (!session.receiverJid.endsWith('@telegram.net') && sock) {
        try {
            console.log(`[Confess/Menfess] Purging receiver chat history for: ${session.receiverJid}`);
            
            await sock.chatModify({
                clear: {
                    keepAsterished: false
                }
            }, session.receiverJid);

            await sock.chatModify({
                delete: true,
                lastMessages: []
            }, session.receiverJid);

            console.log(`[Confess/Menfess] Chat history successfully purged from bot storage.`);
        } catch (e) {
            console.log(`[Confess/Menfess] Note: WhatsApp server chat clear/delete skipped or resolved gracefully: ${e.message}`);
        }
    }

    console.log(chalk.green(`[Confess/Menfess] Session ID: ${session.id} completely closed, and routing data wiped.`));
}
