import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_DIR = path.resolve(__dirname, '..');
const authDir = process.env.AUTH_DIR || './auth';
const BLACKLIST_FILE = path.join(path.resolve(authDir), 'blacklist.json');
const DATA_DIR = path.dirname(BLACKLIST_FILE);

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure blacklist file exists (migrate from old location if available)
if (!fs.existsSync(BLACKLIST_FILE)) {
    const oldBlacklistFile = path.join(BOT_DIR, 'data', 'blacklist.json');
    if (fs.existsSync(oldBlacklistFile)) {
        try {
            fs.copyFileSync(oldBlacklistFile, BLACKLIST_FILE);
            console.log('[Blacklist] Migrated blacklist.json from data/ to auth/');
        } catch (error) {
            console.error('[Blacklist] Failed to migrate blacklist file:', error);
            fs.writeFileSync(BLACKLIST_FILE, JSON.stringify({ blacklist: [] }, null, 2));
        }
    } else {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify({ blacklist: [] }, null, 2));
    }
}

/**
 * Load blacklist from JSON file
 */
export const loadBlacklist = () => {
    try {
        const data = fs.readFileSync(BLACKLIST_FILE, 'utf8');
        const json = JSON.parse(data);
        return json.blacklist || [];
    } catch (error) {
        console.error('[Blacklist] Failed to load blacklist:', error);
        return [];
    }
};

/**
 * Save blacklist to JSON file
 */
export const saveBlacklist = (blacklist) => {
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify({ blacklist }, null, 2));
        return true;
    } catch (error) {
        console.error('[Blacklist] Failed to save blacklist:', error);
        return false;
    }
};

/**
 * Normalize a phone number to only digits
 */
export const normalizeNumber = (num) => {
    if (!num) return '';
    // If it's a full JID (e.g. 6285708950373@s.whatsapp.net), split and get the number part
    const cleanNum = num.split('@')[0].split(':')[0];
    return cleanNum.replace(/\D/g, '');
};

/**
 * Check if a number is blacklisted
 */
export const isBlacklisted = (num) => {
    const normalized = normalizeNumber(num);
    if (!normalized) return false;
    const blacklist = loadBlacklist();
    return blacklist.includes(normalized);
};

/**
 * Add a number to the blacklist
 */
export const addBlacklist = (num) => {
    const normalized = normalizeNumber(num);
    if (!normalized) return false;
    const blacklist = loadBlacklist();

    if (!blacklist.includes(normalized)) {
        blacklist.push(normalized);
        saveBlacklist(blacklist);
        return true;
    }
    return false;
};

/**
 * Remove a number from the blacklist
 */
export const removeBlacklist = (num) => {
    const normalized = normalizeNumber(num);
    if (!normalized) return false;
    const blacklist = loadBlacklist();
    const index = blacklist.indexOf(normalized);

    if (index > -1) {
        blacklist.splice(index, 1);
        saveBlacklist(blacklist);
        return true;
    }
    return false;
};
