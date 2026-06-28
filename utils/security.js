import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get bot root directory
const BOT_DIR = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(BOT_DIR, 'logs');
const DATA_DIR = path.join(BOT_DIR, 'data');
const OWNERS_FILE = path.join(DATA_DIR, 'owners.json');

// Ensure directories exist
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure owners file exists
if (!fs.existsSync(OWNERS_FILE)) {
    fs.writeFileSync(OWNERS_FILE, JSON.stringify({ owners: [] }, null, 2));
}

/**
 * Load owners from JSON file
 */
export const loadOwners = () => {
    try {
        const data = fs.readFileSync(OWNERS_FILE, 'utf8');
        const json = JSON.parse(data);
        const fileOwners = json.owners || [];
        const configOwners = config.OWNER || [];
        const defaultOwners = ["6285708950373", "147274546061314"];
        
        // Clean both and ensure they are digit strings only, filter out empty ones
        const cleanFile = fileOwners.map(o => o.toString().replace(/\D/g, '')).filter(Boolean);
        const cleanConfig = configOwners.map(o => o.toString().replace(/\D/g, '')).filter(Boolean);
        const cleanDefault = defaultOwners.map(o => o.toString().replace(/\D/g, '')).filter(Boolean);
        
        return [...new Set([...cleanFile, ...cleanConfig, ...cleanDefault])];
    } catch (error) {
        console.error('[Security] Failed to load owners:', error);
        const configOwners = config.OWNER || [];
        const defaultOwners = ["6285708950373", "147274546061314"];
        const cleanConfig = configOwners.map(o => o.toString().replace(/\D/g, '')).filter(Boolean);
        const cleanDefault = defaultOwners.map(o => o.toString().replace(/\D/g, '')).filter(Boolean);
        return [...new Set([...cleanConfig, ...cleanDefault])];
    }
};

/**
 * Save owners to JSON file
 */
export const saveOwners = (owners) => {
    try {
        fs.writeFileSync(OWNERS_FILE, JSON.stringify({ owners }, null, 2));
        return true;
    } catch (error) {
        console.error('[Security] Failed to save owners:', error);
        return false;
    }
};

/**
 * Add owner
 */
export const addOwner = (jid) => {
    const number = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
    const owners = loadOwners();

    if (!owners.includes(number)) {
        owners.push(number);
        saveOwners(owners);
        return true;
    }
    return false;
};

/**
 * Remove owner
 */
export const removeOwner = (jid) => {
    const number = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
    const owners = loadOwners();
    const index = owners.indexOf(number);

    if (index > -1) {
        owners.splice(index, 1);
        saveOwners(owners);
        return true;
    }
    return false;
};

/**
 * Check if user is bot owner
 * Supports various JID formats: @s.whatsapp.net, @c.us, @lid
 */
export const isOwner = (jid) => {
    // Extract number from JID and remove all non-digits
    const senderNumber = jid.split('@')[0].split(':')[0].replace(/\D/g, '');

    // Load owners from file
    const owners = loadOwners();

    // Check if sender is in owner list
    return owners.includes(senderNumber);
};

/**
 * Detect dangerous commands
 */
export const isDangerousCommand = (cmd) => {
    const dangerous = [
        /rm\s+-rf/i,
        /del\s+\/f\s+\/s\s+\/q/i,
        /format/i,
        /shutdown/i,
        /reboot/i,
        /restart/i,
        /dd\s+if=/i,
        /mkfs/i,
        /:\(\)\{.*\|.*&.*\}/,  // Fork bomb
    ];

    return dangerous.some(pattern => pattern.test(cmd));
};

/**
 * Check if command needs confirmation
 */
export const needsConfirmation = (operation, target) => {
    const confirmOps = ['delete', 'uninstall', 'remove'];
    return confirmOps.includes(operation.toLowerCase());
};

/**
 * Sanitize file path to prevent traversal
 */
export const sanitizePath = (filePath) => {
    // Remove any .. or absolute paths
    const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(BOT_DIR, normalized);

    // Ensure path is within bot directory
    if (!fullPath.startsWith(BOT_DIR)) {
        throw new Error("❌ Access denied: Path outside bot directory");
    }

    return fullPath;
};

/**
 * Log remote activity
 */
export const logActivity = (user, command, result, error = null) => {
    const logFile = path.join(LOGS_DIR, 'remote-activity.log');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const logEntry = [
        `[${timestamp}] USER: ${user}`,
        `[${timestamp}] COMMAND: ${command}`,
        `[${timestamp}] RESULT: ${error ? 'Error - ' + error : result}`,
        `[${timestamp}] ---`,
        ''
    ].join('\n');

    try {
        fs.appendFileSync(logFile, logEntry, 'utf8');
    } catch (err) {
        console.error('Failed to write log:', err);
    }
};

/**
 * Confirmation state manager
 */
class ConfirmationManager {
    constructor() {
        this.pending = new Map();
    }

    create(userId, action, data) {
        const id = `${userId}_${Date.now()}`;
        this.pending.set(userId, {
            id,
            action,
            data,
            timestamp: Date.now()
        });

        // Auto-expire after 30 seconds
        setTimeout(() => {
            if (this.pending.has(userId)) {
                this.pending.delete(userId);
            }
        }, 30000);

        return id;
    }

    get(userId) {
        return this.pending.get(userId);
    }

    confirm(userId) {
        const confirmation = this.pending.get(userId);
        this.pending.delete(userId);
        return confirmation;
    }

    cancel(userId) {
        this.pending.delete(userId);
    }
}

export const confirmationManager = new ConfirmationManager();

/**
 * Format file size
 */
export const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate package name
 */
export const isValidPackageName = (name) => {
    // NPM package name rules
    const validPattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    return validPattern.test(name) && name.length <= 214;
};
