import { enableSelfMode, disableSelfMode, isSelfModeEnabled, getSelfModeState } from '../../Lib/self_manager.js';

async function resolveGroup(sock, identifier) {
    try {
        if (identifier.endsWith('@g.us')) {
            return { id: identifier, name: '' };
        }

        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);

        // Check if it's an index number
        const num = parseInt(identifier);
        if (!isNaN(num) && num > 0 && num <= groupList.length) {
            const targetGroup = groupList[num - 1];
            return { id: targetGroup.id, name: targetGroup.subject };
        }

        // Search by name (case insensitive, partial match)
        const searchTerm = identifier.toLowerCase();
        const found = groupList.find(g =>
            g.subject.toLowerCase().includes(searchTerm)
        );

        if (found) {
            return { id: found.id, name: found.subject };
        }

        return null;
    } catch (e) {
        console.error('[Self Command] Resolve group error:', e);
        return null;
    }
}

export default {
    name: 'self',
    aliases: ['selfmode', 'public', 'openm', 'safem', 'safemode'],
    tags: ['owner'],
    description: 'Atur bot merespon anggota grup atau hanya owner',
    access: {
        owner: true,
        group: false,
        private: false
    },
    run: async (sock, msg, args, { isGroup, from }) => {
        const action = args[0]?.toLowerCase();
        const target = args.slice(1).join(' ').trim();

        const state = getSelfModeState();

        if (action === 'list') {
            try {
                const groups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(groups);

                let listText = '🤖 *Daftar Grup & Status Self Mode*\n\n';
                listText += `Status Global: *${state.global ? 'ON ❌ (Hanya Owner)' : 'OFF ✅ (Terbuka)'}*\n\n`;

                if (groupList.length === 0) {
                    listText += '_Bot tidak tergabung dalam grup manapun._';
                } else {
                    listText += groupList.map((g, index) => {
                        const isGroupEnabled = state.groups?.[g.id]?.enabled === true;
                        const actualEnabled = state.global || isGroupEnabled;
                        const statusStr = actualEnabled ? 'ON ❌ (Hanya Owner)' : 'OFF ✅ (Terbuka)';
                        return `${index + 1}. *${g.subject}*\n   JID: \`${g.id}\`\n   Status: *${statusStr}*`;
                    }).join('\n\n');
                }

                listText += '\n\n*Cara mengubah status grup:*';
                listText += '\n- `.self on [no/nama/JID]`';
                listText += '\n- `.self off [no/nama/JID]`';
                listText += '\n- `.self on global` (untuk semua chat)';
                listText += '\n- `.self off global` (menonaktifkan global)';

                return sock.sendMessage(from, { text: listText }, { quoted: msg });
            } catch (err) {
                console.error('[Self Command] Error listing groups:', err);
                return sock.sendMessage(from, { text: `❌ Gagal mengambil daftar grup: ${err.message}` }, { quoted: msg });
            }
        }

        if (action === 'on') {
            // Check if global target
            if (target.toLowerCase() === 'global') {
                const saved = enableSelfMode(null);
                return sock.sendMessage(from, {
                    text: saved ? '✅ Self mode global berhasil diaktifkan.' : '❌ Gagal mengaktifkan self mode global.'
                }, { quoted: msg });
            }

            // If target is specified
            if (target) {
                const resolved = await resolveGroup(sock, target);
                if (!resolved) {
                    return sock.sendMessage(from, {
                        text: `❌ Grup dengan identifier "${target}" tidak ditemukan.`
                    }, { quoted: msg });
                }

                const saved = enableSelfMode(resolved.id, resolved.name);
                return sock.sendMessage(from, {
                    text: saved 
                        ? `✅ Self mode berhasil diaktifkan untuk grup:\n*${resolved.name || resolved.id}*`
                        : '❌ Gagal mengaktifkan self mode.'
                }, { quoted: msg });
            }

            // No target, but run inside a group
            if (isGroup) {
                let groupName = '';
                try {
                    const metadata = await sock.groupMetadata(from);
                    groupName = metadata.subject || '';
                } catch (error) {
                    console.error('[Self Command] Failed to read group metadata:', error.message);
                }

                const saved = enableSelfMode(from, groupName);
                return sock.sendMessage(from, {
                    text: saved 
                        ? `✅ Self mode berhasil diaktifkan untuk grup ini:\n*${groupName || from}*`
                        : '❌ Gagal mengaktifkan self mode.'
                }, { quoted: msg });
            }

            // No target, run in private chat
            return sock.sendMessage(from, {
                text: '❌ Tentukan grup yang ingin diaktifkan, atau gunakan `.self list` untuk melihat daftar grup.'
            }, { quoted: msg });
        }

        if (action === 'off') {
            // Check if global target
            if (target.toLowerCase() === 'global') {
                const saved = disableSelfMode(null);
                return sock.sendMessage(from, {
                    text: saved ? '✅ Self mode global berhasil dinonaktifkan.' : '❌ Gagal menonaktifkan self mode global.'
                }, { quoted: msg });
            }

            // If target is specified
            if (target) {
                const resolved = await resolveGroup(sock, target);
                if (!resolved) {
                    return sock.sendMessage(from, {
                        text: `❌ Grup dengan identifier "${target}" tidak ditemukan.`
                    }, { quoted: msg });
                }

                const saved = disableSelfMode(resolved.id);
                return sock.sendMessage(from, {
                    text: saved 
                        ? `✅ Self mode berhasil dinonaktifkan untuk grup:\n*${resolved.name || resolved.id}*`
                        : '❌ Gagal menonaktifkan self mode.'
                }, { quoted: msg });
            }

            // No target, but run inside a group
            if (isGroup) {
                let groupName = '';
                try {
                    const metadata = await sock.groupMetadata(from);
                    groupName = metadata.subject || '';
                } catch (error) {
                    console.error('[Self Command] Failed to read group metadata:', error.message);
                }

                const saved = disableSelfMode(from);
                return sock.sendMessage(from, {
                    text: saved 
                        ? `✅ Self mode berhasil dinonaktifkan untuk grup ini:\n*${groupName || from}*`
                        : '❌ Gagal menonaktifkan self mode.'
                }, { quoted: msg });
            }

            // No target, run in private chat
            return sock.sendMessage(from, {
                text: '❌ Tentukan grup yang ingin dinonaktifkan, atau gunakan `.self list` untuk melihat daftar grup.'
            }, { quoted: msg });
        }

        // Default: display status
        if (isGroup) {
            const isGroupEnabled = state.groups?.[from]?.enabled === true;
            const actualEnabled = state.global || isGroupEnabled;
            let statusText = `self mode status di grup ini: *${actualEnabled ? 'on' : 'off'}*`;
            if (state.global) {
                statusText += ' (Aktif secara Global)';
            } else if (isGroupEnabled) {
                statusText += ' (Aktif khusus grup ini)';
            }
            return sock.sendMessage(from, { text: statusText }, { quoted: msg });
        }

        // If run in private chat with no args, show help/list
        try {
            const groups = await sock.groupFetchAllParticipating();
            const groupList = Object.values(groups);

            let listText = '🤖 *Status Self Mode & Bantuan*\n\n';
            listText += `Status Global: *${state.global ? 'ON ❌ (Hanya Owner)' : 'OFF ✅ (Terbuka)'}*\n\n`;
            listText += '*Daftar Grup yang Diikuti Bot:*\n';

            if (groupList.length === 0) {
                listText += '_Bot tidak tergabung dalam grup manapun._';
            } else {
                listText += groupList.map((g, index) => {
                    const isGroupEnabled = state.groups?.[g.id]?.enabled === true;
                    const actualEnabled = state.global || isGroupEnabled;
                    const statusStr = actualEnabled ? 'ON ❌' : 'OFF ✅';
                    return `${index + 1}. *${g.subject}* (${statusStr})`;
                }).join('\n');
            }

            listText += '\n\n*Penggunaan Perintah:*';
            listText += '\n- `.self list` (Menampilkan daftar detail grup)';
            listText += '\n- `.self on [no/nama/JID]` (Aktifkan grup)';
            listText += '\n- `.self off [no/nama/JID]` (Nonaktifkan grup)';
            listText += '\n- `.self on global` (Aktifkan global)';
            listText += '\n- `.self off global` (Nonaktifkan global)';

            return sock.sendMessage(from, { text: listText }, { quoted: msg });
        } catch (err) {
            console.error('[Self Command] Error listing groups:', err);
            return sock.sendMessage(from, { text: `❌ Gagal mengambil daftar grup: ${err.message}` }, { quoted: msg });
        }
    }
};
