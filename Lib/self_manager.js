import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SELF_FILE = path.join(__dirname, '../data/self_mode.json');
const DATA_DIR = path.dirname(SELF_FILE);

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
    try {
        if (fs.existsSync(SELF_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(SELF_FILE, 'utf8'));
            return {
                global: parsed.global === true,
                groups: parsed.groups || {}
            };
        }
    } catch (error) {
        console.error('[Self Mode] Error loading state:', error);
    }

    return { global: false, groups: {} };
}

function saveState(state) {
    try {
        fs.writeFileSync(SELF_FILE, JSON.stringify(state, null, 2));
        return true;
    } catch (error) {
        console.error('[Self Mode] Error saving state:', error);
        return false;
    }
}

export function isSelfModeEnabled(chatJid) {
    const state = loadState();
    return state.global === true || state.groups?.[chatJid]?.enabled === true;
}

export function isSelfModeDisabledForChat(chatJid) {
    const state = loadState();
    return state.groups?.[chatJid]?.enabled === false;
}

export function enableSelfMode(chatJid, groupName = '') {
    const state = loadState();

    if (chatJid) {
        state.groups[chatJid] = {
            name: groupName,
            enabled: true,
            updatedAt: new Date().toISOString()
        };
    } else {
        state.global = true;
    }

    return saveState(state);
}

export function disableSelfMode(chatJid) {
    const state = loadState();

    if (chatJid) {
        state.groups[chatJid] = {
            ...(state.groups[chatJid] || {}),
            enabled: false,
            updatedAt: new Date().toISOString()
        };
    } else {
        state.global = false;
    }

    return saveState(state);
}

export function getSelfModeState() {
    return loadState();
}
