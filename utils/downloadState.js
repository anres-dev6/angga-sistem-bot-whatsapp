// State management for download sessions
// Stores user selections temporarily (120 seconds)

const pendingDownloads = new Map();

/**
 * Create a new download session
 * @param {string} userId - User JID
 * @param {string} url - Video URL
 * @param {object} metadata - Video metadata
 * @returns {string} Session ID
 */
export function createDownloadSession(userId, url, metadata = {}) {
    const sessionId = `${userId}_${Date.now()}`;

    pendingDownloads.set(userId, {
        sessionId,
        url,
        metadata,
        timestamp: Date.now()
    });

    // Auto cleanup after 120 seconds
    setTimeout(() => {
        if (pendingDownloads.has(userId)) {
            console.log(`[DownloadState] Session expired for ${userId}`);
            pendingDownloads.delete(userId);
        }
    }, 120000);

    return sessionId;
}

/**
 * Get download session for user
 * @param {string} userId - User JID
 * @returns {object|null} Session data or null
 */
export function getDownloadSession(userId) {
    const session = pendingDownloads.get(userId);

    if (!session) return null;

    // Check if expired (120 seconds)
    const elapsed = Date.now() - session.timestamp;
    if (elapsed > 120000) {
        pendingDownloads.delete(userId);
        return null;
    }

    return session;
}

/**
 * Clear download session
 * @param {string} userId - User JID
 */
export function clearDownloadSession(userId) {
    pendingDownloads.delete(userId);
}

/**
 * Get all active sessions (for debugging)
 * @returns {Map} All pending downloads
 */
export function getAllSessions() {
    return pendingDownloads;
}

/**
 * Clear expired sessions manually
 */
export function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [userId, session] of pendingDownloads.entries()) {
        if (now - session.timestamp > 120000) {
            pendingDownloads.delete(userId);
        }
    }
}

// Auto cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 300000);
