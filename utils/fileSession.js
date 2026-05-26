// Session manager for file navigation
class FileSessionManager {
    constructor() {
        this.sessions = new Map();
    }

    setCurrentDir(userId, dir) {
        this.sessions.set(userId, { currentDir: dir, timestamp: Date.now() });
    }

    getCurrentDir(userId) {
        const session = this.sessions.get(userId);
        if (!session) return '.'; // Default to root

        // Auto-expire after 10 minutes
        if (Date.now() - session.timestamp > 600000) {
            this.sessions.delete(userId);
            return '.';
        }

        return session.currentDir;
    }

    clearSession(userId) {
        this.sessions.delete(userId);
    }
}

export const fileSessionManager = new FileSessionManager();
