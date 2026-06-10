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

        // Check if it's a number (from .listgrup)
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
        console.error('[KickBot] Resolve group error:', e);
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

export default {
    name: 'kickbot',
    aliases: ['kickbot', 'leavegroup', 'exitgroup', 'kb'],
    tags: ['owner'],
    description: 'Keluarkan bot dari grup',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args, { isGroup }) => {
        const from = msg.key.remoteJid;

        // If no args and in group, leave current group
        if (args.length === 0 && isGroup) {
            const metadata = await sock.groupMetadata(from);

            // Send farewell message
            await sock.sendMessage(from, {
                text: `sayonara`
            }, { quoted: msg });

            // Leave group
            await sock.groupLeave(from);

            console.log(`[KickBot] Left group: ${metadata.subject} (${from})`);
            return;
        }

        // If no args and not in group, show usage
        if (args.length === 0) {
            return sock.sendMessage(from, {
                text: '❌ *Identifier grup diperlukan!*\n\n' +
                    '📝 *Cara pakai:*\n' +
                    '`.kickbot <nomor/nama/jid>`\n\n' +
                    '💡 *Contoh:*\n' +
                    '`.kickbot 1` (nomor dari .listgrup)\n' +
                    '`.kickbot testing` (nama grup)\n' +
                    '`.kickbot 1,2,3` (multiple grup)\n' +
                    '`.kickbot all` (semua grup)\n\n' +
                    '📋 Gunakan `.listgrup` untuk melihat daftar grup'
            }, { quoted: msg });
        }

        // Parse input
        const parsed = parseIdentifiers(args);

        // Send loading message
        const loading = await sock.sendMessage(from, {
            text: '⏳ *Memproses...*'
        }, { quoted: msg });

        try {
            // Handle 'all' keyword
            if (parsed.type === 'all') {
                const groups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(groups);

                let successCount = 0;
                let results = [];

                for (const group of groupList) {
                    try {
                        await sock.sendMessage(group.id, {
                            text: `sayonara`
                        });

                        // Leave group
                        await sock.groupLeave(group.id);
                        results.push(`✅ ${group.subject}`);
                        successCount++;
                        console.log(`[KickBot] Left group: ${group.subject} (${group.id})`);
                    } catch (err) {
                        results.push(`❌ ${group.subject} - ${err.message}`);
                        console.error(`[KickBot] Failed to leave ${group.subject}:`, err);
                    }
                }

                return sock.sendMessage(from, {
                    text: `🚪 *Keluar dari SEMUA grup:*\n\n${results.join('\n')}\n\n📊 Total: ${successCount}/${groupList.length} berhasil`,
                    edit: loading.key
                });
            }

            // Handle multiple identifiers
            if (parsed.type === 'multiple') {
                let successCount = 0;
                let results = [];

                for (const identifier of parsed.identifiers) {
                    const targetJid = await resolveGroupIdentifier(sock, identifier);

                    if (targetJid) {
                        try {
                            const metadata = await sock.groupMetadata(targetJid);

                            await sock.sendMessage(targetJid, {
                                text: `sayonara`
                            });

                            // Leave group
                            await sock.groupLeave(targetJid);
                            results.push(`✅ ${metadata.subject}`);
                            successCount++;
                            console.log(`[KickBot] Left group: ${metadata.subject} (${targetJid})`);
                        } catch (err) {
                            results.push(`❌ Grup "${identifier}" - ${err.message}`);
                            console.error(`[KickBot] Failed to leave ${identifier}:`, err);
                        }
                    } else {
                        results.push(`❌ Grup "${identifier}" tidak ditemukan`);
                    }
                }

                return sock.sendMessage(from, {
                    text: `🚪 *Keluar dari ${successCount} grup:*\n\n${results.join('\n')}\n\n📊 Total: ${successCount}/${parsed.identifiers.length} berhasil`,
                    edit: loading.key
                });
            }

            // Single identifier (existing logic)
            const identifier = parsed.identifier;
            const targetJid = await resolveGroupIdentifier(sock, identifier);

            if (!targetJid) {
                return sock.sendMessage(from, {
                    text: '❌ *Grup tidak ditemukan!*\n\n' +
                        '💡 Gunakan:\n' +
                        '• `.listgrup` untuk lihat daftar\n' +
                        '• `.kickbot <nomor>` (contoh: `.kickbot 1`)\n' +
                        '• `.kickbot <nama grup>` (contoh: `.kickbot testing`)\n' +
                        '• `.kickbot 1,2,3` (multiple grup)\n' +
                        '• `.kickbot all` (semua grup)',
                    edit: loading.key
                });
            }

            // Get group metadata
            const metadata = await sock.groupMetadata(targetJid);

            await sock.sendMessage(targetJid, {
                text: `sayonara`
            });

            // Leave group
            await sock.groupLeave(targetJid);

            // Send confirmation to owner (edit loading message)
            await sock.sendMessage(from, {
                text: `✅ *Berhasil keluar dari grup!*\n\n` +
                    `📱 *Grup:* ${metadata.subject}\n` +
                    `👥 *Anggota:* ${metadata.participants.length}\n` +
                    `🆔 *ID:* ${targetJid}`,
                edit: loading.key
            });

            console.log(`[KickBot] Left group: ${metadata.subject} (${targetJid})`);

        } catch (error) {
            console.error('[KickBot] Error:', error);

            await sock.sendMessage(from, {
                text: `❌ *Gagal keluar dari grup!*\n\n` +
                    `⚠️ ${error.message || 'Unknown error'}`,
                edit: loading.key
            });
        }
    }
};
