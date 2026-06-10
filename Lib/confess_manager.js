import chalk from 'chalk';

// In-memory sessions store. Key: session ID, Value: session object
export const sessions = new Map();

// 1 hour in milliseconds (1 * 60 * 60 * 1000)
const SESSION_TIMEOUT_MS = 3600000;

/**
 * Standardize phone number input to a valid WhatsApp JID
 * @param {string} num - Phone number (e.g. 0812..., 62812...)
 * @returns {string} JID format (e.g. 62812...@s.whatsapp.net)
 */
export function normalizeJid(num) {
    if (!num) return '';
    let clean = num;
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

    // Store in-memory
    sessions.set(sessionId, session);

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
    console.log(`[Confess] Timer extended for session ID: ${session.id}`);
}

/**
 * Schedules the inactivity timeout trigger for 1 hour
 * @param {object} sock - Baileys socket
 * @param {object} session - Target session
 */
function scheduleTimeout(sock, session) {
    session.timeoutTimer = setTimeout(async () => {
        console.log(chalk.yellow(`[Confess] Session timeout reached for ID: ${session.id}. Terminating...`));
        await terminateConfessSession(sock, session, false);
    }, SESSION_TIMEOUT_MS);
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

    // 2. Remove session from in-memory routing map immediately (secures receiver information)
    sessions.delete(session.id);

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
        // Fallback: log note. Standard Baileys chat delete is highly supported, but fails gracefully if offline/unsupported
        console.log(`[Confess] Note: WhatsApp server chat clear/delete skipped or resolved gracefully: ${e.message}`);
    }

    console.log(chalk.green(`[Confess] Session ID: ${session.id} completely closed, and routing data wiped.`));
}
