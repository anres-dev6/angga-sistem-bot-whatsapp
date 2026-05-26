/**
 * Session Manager - Engine-Aware State Isolation
 * Prevents V1 (yt-dlp) and V2 (ab-downloader) from overlapping
 */

// Global session storage
if (!global.downloadSessions) {
    global.downloadSessions = new Map();
}

/**
 * Create download session with engine binding
 */
export function createSession(chatId, config) {
    const session = {
        engine: config.engine, // 'yt-dlp' or 'ab-downloader'
        stage: config.stage || 'select_quality',
        url: config.url,
        formats: config.formats || [],
        qualities: config.qualities || { video: [], audio: [] },
        page: config.page || 0,
        platform: config.platform || 'unknown',
        title: config.title || 'Media',
        createdAt: Date.now()
    };

    global.downloadSessions.set(chatId, session);

    // Auto-expire after 2 minutes
    setTimeout(() => {
        const current = global.downloadSessions.get(chatId);
        if (current && current.createdAt === session.createdAt) {
            global.downloadSessions.delete(chatId);
            console.log(`[Session] Expired: ${chatId}`);
        }
    }, 120000);

    console.log(`[Session] Created: ${chatId} (engine: ${session.engine})`);
    return session;
}

/**
 * Get session with optional engine validation
 */
export function getSession(chatId, expectedEngine = null) {
    const session = global.downloadSessions.get(chatId);

    if (!session) return null;

    // Check if expired
    if (Date.now() - session.createdAt > 120000) {
        global.downloadSessions.delete(chatId);
        return null;
    }

    // Engine validation
    if (expectedEngine && session.engine !== expectedEngine) {
        console.log(`[Session] Engine mismatch: expected ${expectedEngine}, got ${session.engine}`);
        return null;
    }

    return session;
}

/**
 * Update session (e.g., page navigation)
 */
export function updateSession(chatId, updates) {
    const session = global.downloadSessions.get(chatId);
    if (!session) return false;

    Object.assign(session, updates);
    global.downloadSessions.set(chatId, session);
    return true;
}

/**
 * Delete session
 */
export function deleteSession(chatId) {
    const deleted = global.downloadSessions.delete(chatId);
    if (deleted) {
        console.log(`[Session] Deleted: ${chatId}`);
    }
    return deleted;
}

/**
 * Check if session exists for specific engine
 */
export function hasSession(chatId, engine = null) {
    const session = getSession(chatId, engine);
    return session !== null;
}
