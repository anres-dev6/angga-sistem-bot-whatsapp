import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const SESSIONS_FILE = path.join(process.cwd(), 'data', 'confess_sessions.json');

// In-memory sessions store
export let sessions = new Map();

// 1 hour in milliseconds (1 * 60 * 60 * 1000)
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
 * Standardize phone number input to a valid WhatsApp JID
 * @param {string} num - Phone number (e.g. 0812..., 62812...)
 * @returns {string} JID format (e.g. 62812...@s.whatsapp.net)
 */
export function normalizeJid(num) {
    if (!num) return '';
    let clean = num;
    if (typeof clean === 'string' && clean.endsWith('@lid')) {
        let userPart = clean.split('@')[0];
        if (userPart.includes(':')) {
            userPart = userPart.split(':')[0];
        }
        userPart = userPart.replace(/[^0-9]/g, '');
        return userPart + '@lid';
    }
    if (clean.includes('@')) {
        clean = clean.split('@')[0];
    }
    if (clean.includes(':')) {
        clean = clean.split(':')[0];
    }
    clean = clean.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    }
    if (!clean.endsWith('@s.whatsapp.net')) {
        clean = clean + '@s.whatsapp.net';
    }
    return clean;
}

/**
 * Extract clean phone number digits from a JID
 * @param {string} jid - WhatsApp JID
 * @returns {string} Clean numeric phone number string
 */
export function cleanJid(jid) {
    if (!jid) return '';
    let clean = jid;
    if (clean.includes('@')) {
        clean = clean.split('@')[0];
    }
    if (clean.includes(':')) {
        clean = clean.split(':')[0];
    }
    return clean.replace(/[^0-9]/g, '');
}

/**
 * Check if a JID is currently participating in any active confession session
 * @param {string} jid - User JID
 * @returns {object|null} Active session object or null
 */
export function findSessionByUser(jid) {
    if (!jid) return null;
    const targetClean = cleanJid(jid);
    for (const session of sessions.values()) {
        if (cleanJid(session.senderJid) === targetClean || cleanJid(session.receiverJid) === targetClean) {
            return session;
        }
    }
    return null;
}

/**
 * Creates and starts a new anonymous confession session
 * @param {object} sock - Baileys socket connection
 * @param {string} senderJid - WhatsApp JID of the sender
 * @param {string} senderName - Display alias chosen by sender
 * @param {string} rawReceiver - Target receiver JID or raw number
 * @param {string} firstMessage - Original message to forward
 * @returns {Promise<object>} New session details
 */
export async function createConfessSession(sock, senderJid, senderName, rawReceiver, firstMessage) {
    const normalizedSender = normalizeJid(senderJid);
    const receiverJid = normalizeJid(rawReceiver);

    // Safeguard check: sender cannot confess to themselves
    if (normalizedSender === receiverJid) {
        throw new Error("Anda tidak bisa memulai sesi confess ke nomor Anda sendiri.");
    }

    // Safeguard check: sender or receiver already busy
    const senderActive = findSessionByUser(normalizedSender);
    if (senderActive) {
        throw new Error("Anda sedang berada dalam sesi confess aktif. Tutup sesi saat ini dengan *.confessstop* sebelum memulai sesi baru.");
    }

    const receiverActive = findSessionByUser(receiverJid);
    if (receiverActive) {
        throw new Error("Nomor tujuan sedang berada dalam sesi confess lain saat ini. Silakan coba lagi nanti.");
    }

    const sessionId = `confess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = {
        id: sessionId,
        senderJid: normalizedSender,
        senderName,
        receiverJid,
        lastActivity: Date.now(),
        timeoutTimer: null
    };

    // Store in-memory and disk
    sessions.set(sessionId, session);
    saveSessionsToDisk();

    // Send first message to the receiver anonymously
    const introMessage = `💌 *PESAN BARU*\n\n` +
                         `*Nama Pengirim :*\n${senderName}\n\n` +
                         `*Kepada :*\nPenerima\n\n` +
                         `*Pesan :*\n${firstMessage}\n\n` +
                         `━━━━━━━━━━━━\n` +
                         `📩 _Balas pesan ini langsung untuk membalas secara rahasia._\n` +
                         `⏳ _Sesi akan berakhir otomatis jika tidak ada aktivitas selama 1 jam._\n` +
                         `🔒 _Nomor telepon dirahasiakan oleh sistem._\n` +
                         `━━━━━━━━━━━━`;

    await sock.sendMessage(receiverJid, { text: introMessage });

    // Initialize 1-hour timeout trigger
    scheduleTimeout(sock, session);

    console.log(chalk.green(`[Confess] Session successfully created! ID: ${sessionId}, Sender: ${senderJid}, Receiver: ${receiverJid}`));
    return session;
}

/**
 * Resets the 1-hour timeout timer due to new chat activity
 * @param {object} sock - Baileys socket connection
 * @param {object} session - Target session
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
    console.log(`[Confess] Timer extended for session ID: ${session.id}`);
}

/**
 * Schedules the inactivity timeout trigger
 * @param {object} sock - Baileys socket
 * @param {object} session - Target session
 * @param {number|null} customTime - Specific timeout duration in ms (defaults to SESSION_TIMEOUT_MS)
 */
function scheduleTimeout(sock, session, customTime = null) {
    const timeLimit = customTime !== null ? customTime : SESSION_TIMEOUT_MS;
    session.timeoutTimer = setTimeout(async () => {
        console.log(chalk.yellow(`[Confess] Session timeout reached for ID: ${session.id}. Terminating...`));
        await terminateConfessSession(sock, session, false);
    }, timeLimit);
}

/**
 * Terminates the confession session, cleans up data, and deletes bot's receiver chats
 * @param {object} sock - Baileys socket connection
 * @param {object} session - Target session
 * @param {boolean} manualStop - True if stopped by .confessstop command
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
        ? `🔒 *Sesi Confess telah ditutup secara manual oleh salah satu pihak.*` 
        : `⏳ *SESI BERAKHIR*\n\nTidak ada aktivitas selama 1 jam.\n\nSesi Confess telah ditutup secara otomatis.`;

    try {
        await sock.sendMessage(session.senderJid, { text: endMsg });
    } catch (e) {
        console.error(`[Confess] Failed to send termination to sender:`, e.message);
    }

    try {
        await sock.sendMessage(session.receiverJid, { text: endMsg });
    } catch (e) {
        console.error(`[Confess] Failed to send termination to receiver:`, e.message);
    }

    // 4. Secure Cleanups: Clear and delete chat data relating to the receiver
    try {
        console.log(`[Confess] Purging receiver chat history and JID trace for: ${session.receiverJid}`);
        
        // Clear chat content inside conversation database
        await sock.chatModify({
            clear: {
                keepAsterished: false
            }
        }, session.receiverJid);

        // Delete the chat list entry completely from bot's database/interface
        await sock.chatModify({
            delete: true,
            lastMessages: []
        }, session.receiverJid);

        console.log(`[Confess] Chat history successfully purged from bot storage.`);
    } catch (e) {
        console.log(`[Confess] Note: WhatsApp server chat clear/delete skipped or resolved gracefully: ${e.message}`);
    }

    console.log(chalk.green(`[Confess] Session ID: ${session.id} completely closed, and routing data wiped.`));
}
