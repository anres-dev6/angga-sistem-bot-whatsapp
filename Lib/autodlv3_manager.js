import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTODLV3_FILE = path.join(__dirname, '../data/autodlv3.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function loadState() {
    try {
        if (fs.existsSync(AUTODLV3_FILE)) {
            return JSON.parse(fs.readFileSync(AUTODLV3_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('[AutoDL V3] Error loading state:', error);
    }
    return {};
}

function saveState(state) {
    try {
        fs.writeFileSync(AUTODLV3_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('[AutoDL V3] Error saving state:', error);
    }
}

export function enableAutoDLV3(jid) {
    const state = loadState();
    state[jid] = true;
    saveState(state);
    console.log(`[AutoDL V3] Enabled for ${jid}`);
}

export function disableAutoDLV3(jid) {
    const state = loadState();
    state[jid] = false;
    saveState(state);
    console.log(`[AutoDL V3] Disabled for ${jid}`);
}

export function isAutoDLV3Enabled(jid) {
    const state = loadState();
    return state[jid] === true;
}

export function getEnabledChats() {
    const state = loadState();
    return Object.keys(state).filter(jid => state[jid] === true);
}
