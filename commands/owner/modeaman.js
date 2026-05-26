import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAFE_MODE_FILE = path.join(__dirname, '../../data/safe_mode.json');

// Load safe mode data with auto-migration
function loadSafeMode() {
    try {
        if (!fs.existsSync(SAFE_MODE_FILE)) {
            return { global: false, groups: {} };
        }

        const data = JSON.parse(fs.readFileSync(SAFE_MODE_FILE, 'utf8'));

        // Auto-migrate old format to new format
        if (data.enabled !== undefined && data.global === undefined) {
            console.log('[SafeMode] Migrating old format to new per-group format');
            return {
                global: data.enabled,
                groups: {}
            };
        }

        return data;
    } catch (e) {
        console.error('[SafeMode] Load error:', e);
        return { global: false, groups: {} };
    }
}

// Save safe mode data
function saveSafeMode(data) {
    const dir = path.dirname(SAFE_MODE_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SAFE_MODE_FILE, JSON.stringify(data, null, 2));
}

// Check if safe mode enabled for specific chat
export function isSafeModeEnabledForChat(chatJid) {
    const data = loadSafeMode();

    // Check global first
    if (data.global) return true;

    // Check per-group
    if (chatJid.endsWith('@g.us')) {
        return data.groups?.[chatJid]?.enabled || false;
    }

    // Private chat - check global only
    return data.global;
}

// Legacy function for backward compatibility
export function isSafeModeEnabled() {
    const data = loadSafeMode();
    return data.global;
}

// Enable safe mode for specific group
function enableSafeModeForGroup(groupJid, groupName, ownerNumber) {
    const data = loadSafeMode();
    if (!data.groups) data.groups = {};

    data.groups[groupJid] = {
        name: groupName,
        enabled: true,
        enabledAt: new Date().toISOString(),
        enabledBy: ownerNumber
    };

    saveSafeMode(data);
    console.log(`[SafeMode] Enabled for group: ${groupName} (${groupJid})`);
}

// Disable safe mode for specific group
function disableSafeModeForGroup(groupJid) {
    const data = loadSafeMode();
    if (data.groups?.[groupJid]) {
        const groupName = data.groups[groupJid].name;
        delete data.groups[groupJid];
        saveSafeMode(data);
        console.log(`[SafeMode] Disabled for group: ${groupName} (${groupJid})`);
        return groupName;
    }
    return null;
}

// Resolve group identifier (name, number, or JID) to JID
async function resolveGroupIdentifier(sock, identifier) {
    try {
        // If it's already a JID
        if (identifier.endsWith('@g.us')) {
            return identifier;
        }

        // Get all groups
        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);

        // Check if it's a number (from .listsafe or .listgroups)
        const num = parseInt(identifier);
        if (!isNaN(num) && num > 0 && num <= groupList.length) {
            return groupList[num - 1].id;
        }

        // Search by name (case insensitive, partial match)
        const searchTerm = identifier.toLowerCase();
        const found = groupList.find(g =>
            g.subject.toLowerCase().includes(searchTerm)
        );

        if (found) {
            return found.id;
        }

        return null;
    } catch (e) {
        console.error('[SafeMode] Resolve group error:', e);
        return null;
    }
}

// Parse identifiers - support multiple formats
function parseIdentifiers(args) {
    const input = args.join(' ').trim();

    // Check for 'all' keyword
    if (input.toLowerCase() === 'all') {
        return { type: 'all' };
    }

    // Check for comma-separated: 1,2,3
    if (input.includes(',')) {
        const identifiers = input.split(',').map(n => n.trim()).filter(n => n);
        return { type: 'multiple', identifiers };
    }

    // Check for space-separated numbers: 1 2 3
    const parts = input.split(' ').filter(p => p.trim());
    if (parts.length > 1 && parts.every(p => !isNaN(parseInt(p)))) {
        return { type: 'multiple', identifiers: parts };
    }

    // Single identifier (number, name, or JID)
    return { type: 'single', identifier: input };
}

// Get all safe groups
function getSafeGroups() {
    const data = loadSafeMode();
    return data.groups || {};
}

// Get group name from metadata
async function getGroupName(sock, groupJid) {
    try {
        const metadata = await sock.groupMetadata(groupJid);
        return metadata.subject;
    } catch (e) {
        console.error('[SafeMode] Failed to get group name:', e.message);
        return 'Unknown Group';
    }
}

// Format date for display
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default {
    name: 'safemode',
    aliases: ['safemode', 'safem', 'openmode', 'openm', 'listsafe', 'listgroups', 'listgrup'],
    tags: ['owner'],
    description: 'Kelola safe mode per grup atau global',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args, { command, isGroup }) => {
        const from = msg.key.remoteJid;
        const cmd = command.toLowerCase();
        const sender = isGroup ? (msg.key.participant || msg.participant) : from;
        const senderNumber = sender.split('@')[0];

        // ===== LIST SAFE GROUPS =====
        if (cmd === 'listsafe') {
            const safeGroups = getSafeGroups();
            const groupList = Object.entries(safeGroups);

            if (groupList.length === 0) {
                return sock.sendMessage(from, {
                    text: '📋 *Tidak ada grup dalam Safe Mode*\n\n💡 Gunakan `.safem` di grup untuk mengaktifkan'
                }, { quoted: msg });
            }

            let text = '🔒 *Grup dalam Safe Mode:*\n\n';

            groupList.forEach(([jid, info], index) => {
                text += `${index + 1}. *${info.name}*\n`;
                text += `   📅 Aktif: ${formatDate(info.enabledAt)}\n`;
                text += `   👤 Oleh: ${info.enabledBy}\n\n`;
            });

            text += `📊 Total: ${groupList.length} grup\n\n`;
            text += '💡 *Cara disable:*\n';
            text += '`.openm` (di grup tersebut)\n';
            text += '`.openm <nomor>` (contoh: `.openm 1`)\n';
            text += '`.openm <nama grup>` (contoh: `.openm testing`)\n';
            text += '`.openm 1,2,3` (multiple)\n';
            text += '`.openm all` (semua grup)';

            return sock.sendMessage(from, { text }, { quoted: msg });
        }

        // ===== LIST ALL GROUPS =====
        if (cmd === 'listgroups' || cmd === 'listgrup') {
            try {
                const groups = await sock.groupFetchAllParticipating();
                const safeGroups = getSafeGroups();

                let text = '📋 *Daftar Grup Bot:*\n\n';

                Object.values(groups).forEach((group, index) => {
                    const isSafe = safeGroups[group.id]?.enabled;
                    const icon = isSafe ? '🔒' : '🔓';
                    text += `${index + 1}. ${icon} *${group.subject}*\n`;
                    text += `   👥 ${group.participants.length} anggota\n`;
                    text += `   ${isSafe ? '🔒 Safe Mode: Aktif' : '🔓 Safe Mode: Tidak aktif'}\n\n`;
                });

                text += `📊 Total: ${Object.keys(groups).length} grup\n\n`;
                text += '💡 *Cara enable/disable:*\n';
                text += '`.safem <nomor>` atau `.safem <nama>`\n';
                text += '`.safem 1,2,3` (multiple)\n';
                text += '`.safem all` (semua grup)';

                return sock.sendMessage(from, { text }, { quoted: msg });
            } catch (e) {
                console.error('[SafeMode] List groups error:', e);
                return sock.sendMessage(from, {
                    text: '❌ Gagal mengambil daftar grup'
                }, { quoted: msg });
            }
        }

        // ===== ENABLE SAFE MODE =====
        if (cmd === 'safemode' || cmd === 'safem') {
            // Parse input
            const parsed = parseIdentifiers(args);

            // Handle 'all' keyword
            if (parsed.type === 'all') {
                const groups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(groups);

                let successCount = 0;
                let results = [];

                for (const group of groupList) {
                    const groupName = group.subject;
                    enableSafeModeForGroup(group.id, groupName, senderNumber);
                    results.push(`✅ ${groupName}`);
                    successCount++;
                }

                return sock.sendMessage(from, {
                    text: `🔒 *Safe Mode Aktif untuk SEMUA grup:*\n\n${results.join('\n')}\n\n📊 Total: ${successCount} grup diaktifkan`
                }, { quoted: msg });
            }

            // Handle multiple identifiers
            if (parsed.type === 'multiple') {
                let successCount = 0;
                let results = [];

                for (const identifier of parsed.identifiers) {
                    const targetJid = await resolveGroupIdentifier(sock, identifier);

                    if (targetJid) {
                        const groupName = await getGroupName(sock, targetJid);
                        enableSafeModeForGroup(targetJid, groupName, senderNumber);
                        results.push(`✅ ${groupName}`);
                        successCount++;
                    } else {
                        results.push(`❌ Grup "${identifier}" tidak ditemukan`);
                    }
                }

                return sock.sendMessage(from, {
                    text: `🔒 *Safe Mode Aktif untuk ${successCount} grup:*\n\n${results.join('\n')}\n\n📊 Total: ${successCount}/${parsed.identifiers.length} berhasil`
                }, { quoted: msg });
            }

            // Single identifier (existing logic)
            const targetIdentifier = parsed.identifier;

            if (targetIdentifier) {
                // Remote management - resolve identifier to JID
                const targetJid = await resolveGroupIdentifier(sock, targetIdentifier);

                if (!targetJid) {
                    return sock.sendMessage(from, {
                        text: '❌ Grup tidak ditemukan\n\n💡 Gunakan:\n- `.listgroups` untuk lihat daftar\n- `.safem <nomor>` (contoh: `.safem 1`)\n- `.safem <nama grup>` (contoh: `.safem testing`)\n- `.safem 1,2,3` (multiple)\n- `.safem all` (semua grup)'
                    }, { quoted: msg });
                }

                const groupName = await getGroupName(sock, targetJid);
                enableSafeModeForGroup(targetJid, groupName, senderNumber);

                return sock.sendMessage(from, {
                    text: `🔒 *Safe Mode Aktif*\n\n📱 Grup: ${groupName}\n\n✅ Bot hanya merespon owner di grup tersebut`
                }, { quoted: msg });
            }

            // Enable for current chat
            if (isGroup) {
                const groupName = await getGroupName(sock, from);
                enableSafeModeForGroup(from, groupName, senderNumber);

                return sock.sendMessage(from, {
                    text: `🔒 *Safe Mode Aktif*\n\n✅ Bot hanya merespon owner di grup ini`
                }, { quoted: msg });
            } else {
                // Enable global safe mode from private chat
                const data = loadSafeMode();
                data.global = true;
                saveSafeMode(data);

                return sock.sendMessage(from, {
                    text: `🔒 *Global Safe Mode Aktif*\n\n✅ Bot hanya merespon owner di SEMUA chat`
                }, { quoted: msg });
            }
        }

        // ===== DISABLE SAFE MODE =====
        if (cmd === 'openmode' || cmd === 'openm') {
            // Parse input
            const parsed = parseIdentifiers(args);

            // Handle 'all' keyword
            if (parsed.type === 'all') {
                const safeGroups = getSafeGroups();
                const groupList = Object.entries(safeGroups);

                let successCount = 0;
                let results = [];

                for (const [jid, info] of groupList) {
                    disableSafeModeForGroup(jid);
                    results.push(`✅ ${info.name}`);
                    successCount++;
                }

                if (successCount === 0) {
                    return sock.sendMessage(from, {
                        text: '📋 Tidak ada grup dalam safe mode'
                    }, { quoted: msg });
                }

                return sock.sendMessage(from, {
                    text: `🔓 *Safe Mode Dinonaktifkan untuk SEMUA grup:*\n\n${results.join('\n')}\n\n📊 Total: ${successCount} grup dinonaktifkan`
                }, { quoted: msg });
            }

            // Handle multiple identifiers
            if (parsed.type === 'multiple') {
                let successCount = 0;
                let results = [];

                for (const identifier of parsed.identifiers) {
                    const targetJid = await resolveGroupIdentifier(sock, identifier);

                    if (targetJid) {
                        const groupName = disableSafeModeForGroup(targetJid);

                        if (groupName) {
                            results.push(`✅ ${groupName}`);
                            successCount++;
                        } else {
                            results.push(`❌ Grup "${identifier}" tidak dalam safe mode`);
                        }
                    } else {
                        results.push(`❌ Grup "${identifier}" tidak ditemukan`);
                    }
                }

                return sock.sendMessage(from, {
                    text: `🔓 *Safe Mode Dinonaktifkan untuk ${successCount} grup:*\n\n${results.join('\n')}\n\n📊 Total: ${successCount}/${parsed.identifiers.length} berhasil`
                }, { quoted: msg });
            }

            // Single identifier (existing logic)
            const targetIdentifier = parsed.identifier;

            if (targetIdentifier) {
                // Remote management - resolve identifier to JID
                const targetJid = await resolveGroupIdentifier(sock, targetIdentifier);

                if (!targetJid) {
                    return sock.sendMessage(from, {
                        text: '❌ Grup tidak ditemukan\n\n💡 Gunakan:\n- `.listsafe` untuk lihat daftar\n- `.openm <nomor>` (contoh: `.openm 1`)\n- `.openm <nama grup>` (contoh: `.openm testing`)\n- `.openm 1,2,3` (multiple)\n- `.openm all` (semua grup)'
                    }, { quoted: msg });
                }

                const groupName = disableSafeModeForGroup(targetJid);

                if (!groupName) {
                    return sock.sendMessage(from, {
                        text: '❌ Grup tersebut tidak dalam safe mode'
                    }, { quoted: msg });
                }

                return sock.sendMessage(from, {
                    text: `🔓 *Safe Mode Dinonaktifkan*\n\n📱 Grup: ${groupName}\n\n✅ Bot merespon semua user di grup tersebut`
                }, { quoted: msg });
            }

            // Disable for current chat
            if (isGroup) {
                const groupName = disableSafeModeForGroup(from);

                if (!groupName) {
                    return sock.sendMessage(from, {
                        text: '❌ Grup ini tidak dalam safe mode'
                    }, { quoted: msg });
                }

                return sock.sendMessage(from, {
                    text: `🔓 *Open Mode Aktif*\n\n✅ Bot merespon semua user di grup ini`
                }, { quoted: msg });
            } else {
                // Disable global safe mode from private chat
                const data = loadSafeMode();
                data.global = false;
                saveSafeMode(data);

                return sock.sendMessage(from, {
                    text: `🔓 *Global Safe Mode Dinonaktifkan*\n\n✅ Bot merespon semua user (kecuali grup dengan safe mode aktif)`
                }, { quoted: msg });
            }
        }
    }
};
