import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.join(__dirname, 'autodl_store.json');

/**
 * AutoDL Manager Module
 * Handles state management for Auto Download feature
 */

class AutoDLManager {
    constructor() {
        this.state = {};
        this.storePath = storePath;
        this.loadState();
    }

    /**
     * Load AutoDL state from JSON file
     * @returns {Object} Current state
     */
    loadState() {
        try {
            if (fs.existsSync(this.storePath)) {
                const data = fs.readFileSync(this.storePath, 'utf-8');
                this.state = JSON.parse(data);
                global.autodl = this.state;
                console.log('[AutoDL Manager] State loaded:', Object.keys(this.state).length, 'entries');
            } else {
                this.state = {};
                global.autodl = this.state;
                console.log('[AutoDL Manager] No existing state, initialized empty');
            }
        } catch (e) {
            console.error('[AutoDL Manager] Failed to load state:', e.message);
            this.state = {};
            global.autodl = this.state;
        }
        return this.state;
    }

    /**
     * Save current state to JSON file
     * @returns {boolean} Success status
     */
    saveState() {
        try {
            fs.writeFileSync(this.storePath, JSON.stringify(this.state, null, 2));
            console.log('[AutoDL Manager] State saved successfully');
            return true;
        } catch (e) {
            console.error('[AutoDL Manager] Failed to save state:', e.message);
            return false;
        }
    }

    /**
     * Set AutoDL status for a specific chat
     * @param {string} jid - Chat JID
     * @param {boolean} isActive - Enable/disable status
     * @returns {boolean} Success status
     */
    setAutoDL(jid, isActive) {
        if (!jid) {
            console.error('[AutoDL Manager] Invalid JID provided');
            return false;
        }

        this.loadState();
        this.state[jid] = isActive;
        global.autodl = this.state;

        const saved = this.saveState();
        if (saved) {
            console.log(`[AutoDL Manager] AutoDL ${isActive ? 'enabled' : 'disabled'} for ${jid}`);
        }
        return saved;
    }

    /**
     * Check if AutoDL is enabled for a specific chat
     * @param {string} jid - Chat JID
     * @returns {boolean} Enabled status
     */
    isEnabled(jid) {
        this.loadState();
        return !!this.state[jid];
    }

    /**
     * Get all enabled chats
     * @returns {Array} List of enabled chat JIDs
     */
    getEnabledChats() {
        this.loadState();
        return Object.keys(this.state).filter(jid => this.state[jid]);
    }

    /**
     * Get total count of enabled chats
     * @returns {number} Count
     */
    getEnabledCount() {
        return this.getEnabledChats().length;
    }

    /**
     * Disable AutoDL for a specific chat
     * @param {string} jid - Chat JID
     * @returns {boolean} Success status
     */
    disable(jid) {
        return this.setAutoDL(jid, false);
    }

    /**
     * Enable AutoDL for a specific chat
     * @param {string} jid - Chat JID
     * @returns {boolean} Success status
     */
    enable(jid) {
        return this.setAutoDL(jid, true);
    }

    /**
     * Toggle AutoDL status for a specific chat
     * @param {string} jid - Chat JID
     * @returns {boolean} New status
     */
    toggle(jid) {
        const newStatus = !this.isEnabled(jid);
        this.setAutoDL(jid, newStatus);
        return newStatus;
    }

    /**
     * Clear all AutoDL settings
     * @returns {boolean} Success status
     */
    clearAll() {
        this.state = {};
        global.autodl = this.state;
        return this.saveState();
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }
}

// Create singleton instance
const manager = new AutoDLManager();

// Export both the instance and individual functions for backward compatibility
export const loadState = () => manager.loadState();
export const saveState = () => manager.saveState();
export const setAutoDL = (jid, isActive) => manager.setAutoDL(jid, isActive);
export const isAutoDLEnabled = (jid) => manager.isEnabled(jid);

// Export the manager instance as default
export default manager;
