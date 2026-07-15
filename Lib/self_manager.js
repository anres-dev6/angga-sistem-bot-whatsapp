import fs from 'fs';
import path from 'path';

const authDir = process.env.AUTH_DIR || './auth';
const SELF_FILE = path.join(path.resolve(authDir), 'self_mode.json');
const DATA_DIR = path.dirname(SELF_FILE);

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Global cached in-memory state
let cachedState = { global: false, groups: {} };
let isLoaded = false;

/**
 * Asynchronously load self mode state on module import
 */
async function initializeState() {
    try {
        const hasDb = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
        if (hasDb) {
            const { getSessionData } = await import('../utils/authDb.js');
            const data = await getSessionData('global', 'self_mode.json');
            if (data) {
                cachedState = {
                    global: data.global === true,
                    groups: data.groups || {}
                };
                isLoaded = true;
                console.log('[Self Mode] Loaded state from database successfully.');
                return;
            }
        }
    } catch (err) {
        console.error('[Self Mode] Failed to load state from database, using fallback:', err.message);
    }

    // Local file fallback
    try {
        if (fs.existsSync(SELF_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(SELF_FILE, 'utf8'));
            cachedState = {
                global: parsed.global === true,
                groups: parsed.groups || {}
            };
            console.log('[Self Mode] Loaded state from local file.');
        }
    } catch (error) {
        console.error('[Self Mode] Error loading state from file:', error);
    }
    isLoaded = true;
}

// Trigger initialization immediately
initializeState();

/**
 * Asynchronously persist state to file and database
 */
async function persistState(state) {
    // 1. Local file write
    try {
        fs.writeFileSync(SELF_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('[Self Mode] Error saving state to file:', error);
    }

    // 2. Database write
    try {
        const hasDb = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
        if (hasDb) {
            const { setSessionData } = await import('../utils/authDb.js');
            await setSessionData('global', 'self_mode.json', state);
            console.log('[Self Mode] Saved state to database successfully.');
        }
    } catch (err) {
        console.error('[Self Mode] Failed to save state to database:', err.message);
    }
}

export function isSelfModeEnabled(chatJid) {
    return cachedState.global === true || cachedState.groups?.[chatJid]?.enabled === true;
}

export function isSelfModeDisabledForChat(chatJid) {
    return cachedState.groups?.[chatJid]?.enabled === false;
}

export function enableSelfMode(chatJid, groupName = '') {
    if (chatJid) {
        cachedState.groups[chatJid] = {
            name: groupName,
            enabled: true,
            updatedAt: new Date().toISOString()
        };
    } else {
        cachedState.global = true;
    }

    persistState(cachedState);
    return true;
}

export function disableSelfMode(chatJid) {
    if (chatJid) {
        cachedState.groups[chatJid] = {
            ...(cachedState.groups[chatJid] || {}),
            enabled: false,
            updatedAt: new Date().toISOString()
        };
    } else {
        cachedState.global = false;
    }

    persistState(cachedState);
    return true;
}

export function getSelfModeState() {
    return cachedState;
}
