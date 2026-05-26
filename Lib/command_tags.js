import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TAGS_FILE = path.join(__dirname, '../data/command_tags.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Load custom tags from file
 * @returns {object} Object mapping command names to tags
 */
function loadTags() {
    try {
        if (fs.existsSync(TAGS_FILE)) {
            const data = fs.readFileSync(TAGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Command Tags] Error loading:', error);
    }
    return {};
}

/**
 * Save custom tags to file
 * @param {object} tags - Object mapping command names to tags
 */
function saveTags(tags) {
    try {
        fs.writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 2));
    } catch (error) {
        console.error('[Command Tags] Error saving:', error);
    }
}

/**
 * Set custom tag for a command
 * @param {string} commandName - Command name
 * @param {string} tag - New tag
 */
export function setCommandTag(commandName, tag) {
    const tags = loadTags();
    tags[commandName] = tag;
    saveTags(tags);
    console.log(`[Tags] Set ${commandName} -> ${tag}`);
}

/**
 * Get custom tag for a command
 * @param {string} commandName - Command name
 * @returns {string|null} Custom tag or null
 */
export function getCommandTag(commandName) {
    const tags = loadTags();
    return tags[commandName] || null;
}

/**
 * Remove custom tag for a command
 * @param {string} commandName - Command name
 */
export function removeCommandTag(commandName) {
    const tags = loadTags();
    delete tags[commandName];
    saveTags(tags);
    console.log(`[Tags] Removed tag for ${commandName}`);
}

/**
 * Get all custom tags
 * @returns {object} All custom tags
 */
export function getAllCustomTags() {
    return loadTags();
}
