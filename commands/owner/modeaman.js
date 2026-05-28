import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAFE_MODE_FILE = path.join(__dirname, '../../data/safe_mode.json');

function loadSafeMode() {
    try {
        if (fs.existsSync(SAFE_MODE_FILE)) {
            const data = JSON.parse(fs.readFileSync(SAFE_MODE_FILE, 'utf8'));
            return {
                global: data.global === true,
                groups: data.groups || {}
            };
        }
    } catch (error) {
        console.error('[SafeMode] Failed to load safe mode:', error.message);
    }

    return { global: false, groups: {} };
}

export function isSafeModeEnabledForChat(chatJid) {
    const data = loadSafeMode();
    return data.global === true || data.groups?.[chatJid]?.enabled === true;
}

export default {
    name: 'safemode',
    aliases: ['safemode', 'safem', 'openmode', 'openm', 'listsafe', 'listgroups', 'listgrup'],
    tags: ['owner'],
    description: 'Deprecated: gunakan .self on/off',
    access: {
        owner: true,
        group: false,
        private: false
    },
    run: async (sock, msg) => {
        const from = msg.key.remoteJid;
        return sock.sendMessage(from, {
            text: 'Perintah `safemode/openmode` sudah digantikan dengan `.self on` dan `.self off`.\n\nGunakan `.self` untuk melihat status.'
        }, { quoted: msg });
    }
};
