import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTODLV2_FILE = path.join(__dirname, '../data/autodlv2.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Load AutoDL V2 state from file
 * @returns {object} State object
 */
function loadState() {
    try {
        if (fs.existsSync(AUTODLV2_FILE)) {
            const data = fs.readFileSync(AUTODLV2_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[AutoDL V2] Error loading state:', error);
    }
    return {};
}

/**
 * Save AutoDL V2 state to file
 * @param {object} state - State to save
 */
function saveState(state) {
    try {
        fs.writeFileSync(AUTODLV2_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('[AutoDL V2] Error saving state:', error);
    }
}

/**
 * Enable AutoDL V2 for a chat
 * @param {string} jid - Chat JID
 */
export function enableAutoDLV2(jid) {
    const state = loadState();
    state[jid] = true;
    saveState(state);
    console.log(`[AutoDL V2] Enabled for ${jid}`);
}

/**
 * Disable AutoDL V2 for a chat
 * @param {string} jid - Chat JID
 */
export function disableAutoDLV2(jid) {
    const state = loadState();
    state[jid] = false;
    saveState(state);
    console.log(`[AutoDL V2] Disabled for ${jid}`);
}

/**
 * Check if AutoDL V2 is enabled for a chat
 * @param {string} jid - Chat JID
 * @returns {boolean} True if enabled
 */
export function isAutoDLV2Enabled(jid) {
    const state = loadState();
    return state[jid] === true;
}

/**
 * Get all chats with AutoDL V2 enabled
 * @returns {Array<string>} Array of JIDs
 */
export function getEnabledChats() {
    const state = loadState();
    return Object.keys(state).filter(jid => state[jid] === true);
}

/**
 * Get AutoDL V2 status for all chats
 * @returns {object} State object
 */
export function getStatus() {
    return loadState();
}
