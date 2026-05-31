import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.join(__dirname, 'autosticker_store.json');

class AutoStickerManager {
    constructor() {
        this.state = {};
        this.storePath = storePath;
        this.loadState();
    }

    loadState() {
        try {
            if (fs.existsSync(this.storePath)) {
                const data = fs.readFileSync(this.storePath, 'utf-8');
                this.state = JSON.parse(data);
                global.autosticker = this.state;
                console.log('[AutoSticker Manager] State loaded:', Object.keys(this.state).length, 'entries');
            } else {
                this.state = {};
                global.autosticker = this.state;
                console.log('[AutoSticker Manager] No existing state, initialized empty');
            }
        } catch (e) {
            console.error('[AutoSticker Manager] Failed to load state:', e.message);
            this.state = {};
            global.autosticker = this.state;
        }
        return this.state;
    }

    saveState() {
        try {
            fs.writeFileSync(this.storePath, JSON.stringify(this.state, null, 2));
            console.log('[AutoSticker Manager] State saved successfully');
            return true;
        } catch (e) {
            console.error('[AutoSticker Manager] Failed to save state:', e.message);
            return false;
        }
    }

    setAutoSticker(jid, isActive) {
        if (!jid) {
            console.error('[AutoSticker Manager] Invalid JID provided');
            return false;
        }

        this.state[jid] = isActive;
        global.autosticker = this.state;

        const saved = this.saveState();
        if (saved) {
            console.log(`[AutoSticker Manager] AutoSticker ${isActive ? 'enabled' : 'disabled'} for ${jid}`);
        }
        return saved;
    }

    isEnabled(jid) {
        return !!this.state[jid];
    }
}

const manager = new AutoStickerManager();

export const setAutoSticker = (jid, isActive) => manager.setAutoSticker(jid, isActive);
export const isAutoStickerEnabled = (jid) => manager.isEnabled(jid);

export default manager;
