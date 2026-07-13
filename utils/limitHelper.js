import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIMITS_FILE = path.join(__dirname, '../data/user_limits.json');
const MAX_LIMIT = 50;

// Ensure limits file exists
function ensureFile() {
    const dir = path.dirname(LIMITS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LIMITS_FILE)) {
        fs.writeFileSync(LIMITS_FILE, JSON.stringify({}, null, 2));
    }
}

// Load limits from file
function loadLimits() {
    ensureFile();
    try {
        const data = fs.readFileSync(LIMITS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('[Limit Helper] Failed to load limits:', e);
        return {};
    }
}

// Save limits to file
function saveLimits(limits) {
    ensureFile();
    try {
        fs.writeFileSync(LIMITS_FILE, JSON.stringify(limits, null, 2));
        return true;
    } catch (e) {
        console.error('[Limit Helper] Failed to save limits:', e);
        return false;
    }
}

/**
 * Check if the user is allowed to execute a command
 * @param {string} senderNumber - The sender phone number
 * @param {boolean} isOwner - Whether the sender is owner
 * @returns {boolean} True if allowed, false if limit reached
 */
export function checkLimit(senderNumber, isOwner) {
    if (isOwner) return true; // Owner has infinite limit

    const limits = loadLimits();
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    let userData = limits[senderNumber];

    if (!userData) {
        userData = {
            count: 0,
            lastResetDate: today
        };
    }

    // Reset limit if it is a new day
    if (userData.lastResetDate !== today) {
        userData.count = 0;
        userData.lastResetDate = today;
    }

    // Check if limit reached
    if (userData.count >= MAX_LIMIT) {
        return false;
    }

    // Increment count and save
    userData.count += 1;
    limits[senderNumber] = userData;
    saveLimits(limits);

    return true;
}

/**
 * Get remaining quota for a user
 * @param {string} senderNumber - The sender phone number
 * @param {boolean} isOwner - Whether the sender is owner
 * @returns {number} Remaining count (MAX_LIMIT - count)
 */
export function getLimitRemaining(senderNumber, isOwner) {
    if (isOwner) return Infinity;

    const limits = loadLimits();
    const today = new Date().toISOString().split('T')[0];
    const userData = limits[senderNumber];

    if (!userData || userData.lastResetDate !== today) {
        return MAX_LIMIT;
    }

    return Math.max(0, MAX_LIMIT - userData.count);
}
