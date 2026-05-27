export default {
    name: 'safemode',
    aliases: ['safemode', 'safem', 'openmode', 'openm', 'listsafe', 'listgroups', 'listgrup'],
    tags: ['owner'],
    description: 'DEPRECATED: gunakan .self on/off untuk menggantikan safe mode/openmode',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg) => {
        const from = msg.key.remoteJid;
        return sock.sendMessage(from, { text: 'Perintah `safemode/openmode` sudah digantikan dengan command `.self on` dan `.self off`. Gunakan `.self` untuk melihat status.' }, { quoted: msg });
    }
};        // ===== ENABLE SAFE MODE =====
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
