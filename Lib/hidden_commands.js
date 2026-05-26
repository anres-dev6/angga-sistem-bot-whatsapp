import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HIDDEN_FILE = path.join(__dirname, '../data/hidden_commands.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Load hidden commands from file
 * @returns {Array<string>} Array of hidden command names
 */
function loadHidden() {
    try {
        if (fs.existsSync(HIDDEN_FILE)) {
            const data = fs.readFileSync(HIDDEN_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Hidden Commands] Error loading:', error);
    }
    return [];
}

/**
 * Save hidden commands to file
 * @param {Array<string>} hiddenList - Array of command names
 */
function saveHidden(hiddenList) {
    try {
        fs.writeFileSync(HIDDEN_FILE, JSON.stringify(hiddenList, null, 2));
    } catch (error) {
        console.error('[Hidden Commands] Error saving:', error);
    }
}

/**
 * Hide a command from menu
 * @param {string} commandName - Command name to hide
 * @returns {boolean} Success
 */
export function hideCommand(commandName) {
    const hidden = loadHidden();
    if (!hidden.includes(commandName)) {
        hidden.push(commandName);
        saveHidden(hidden);
        console.log(`[Hidden] Command hidden: ${commandName}`);
        return true;
    }
    return false;
}

/**
 * Show a previously hidden command
 * @param {string} commandName - Command name to show
 * @returns {boolean} Success
 */
export function showCommand(commandName) {
    const hidden = loadHidden();
    const index = hidden.indexOf(commandName);
    if (index > -1) {
        hidden.splice(index, 1);
        saveHidden(hidden);
        console.log(`[Hidden] Command shown: ${commandName}`);
        return true;
    }
    return false;
}

/**
 * Check if command is hidden
 * @param {string} commandName - Command name to check
 * @returns {boolean} True if hidden
 */
export function isCommandHidden(commandName) {
    const hidden = loadHidden();
    return hidden.includes(commandName);
}

/**
 * Get all hidden commands
 * @returns {Array<string>} Array of hidden command names
 */
export function getHiddenCommands() {
    return loadHidden();
}
