import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'clearsesi',
    aliases: ['clearsession', 'clearses', 'cs'],
    tags: ['tools'],
    description: 'Hapus file sesi untuk mencegah crash video',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args, { isOwner }) => {
        const from = msg.key.remoteJid;

        if (!isOwner) {
            return sock.sendMessage(from, {
                text: "❌ Command ini hanya untuk owner bot."
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, {
                react: { text: '🗑️', key: msg.key }
            });

            const botDir = path.join(__dirname, '..');
            let deletedFiles = [];
            let errors = [];

            // 1. Clear player-script.js files (temporary Chrome DevTools files)
            const playerScriptPattern = /^\d+-player-script\.js$/;
            const files = fs.readdirSync(botDir);

            for (const file of files) {
                if (playerScriptPattern.test(file)) {
                    try {
                        const filePath = path.join(botDir, file);
                        fs.unlinkSync(filePath);
                        deletedFiles.push(file);
                        console.log(`[ClearSesi] Deleted: ${file}`);
                    } catch (err) {
                        errors.push(`${file}: ${err.message}`);
                        console.error(`[ClearSesi] Error deleting ${file}:`, err);
                    }
                }
            }

            // 2. Clear download folder (temporary video files)
            const downloadDir = path.join(botDir, 'download');
            if (fs.existsSync(downloadDir)) {
                try {
                    const downloadFiles = fs.readdirSync(downloadDir);
                    for (const file of downloadFiles) {
                        try {
                            const filePath = path.join(downloadDir, file);
                            const stats = fs.statSync(filePath);

                            if (stats.isFile()) {
                                fs.unlinkSync(filePath);
                                deletedFiles.push(`download/${file}`);
                                console.log(`[ClearSesi] Deleted: download/${file}`);
                            }
                        } catch (err) {
                            errors.push(`download/${file}: ${err.message}`);
                            console.error(`[ClearSesi] Error deleting download/${file}:`, err);
                        }
                    }
                } catch (err) {
                    errors.push(`download folder: ${err.message}`);
                    console.error('[ClearSesi] Error reading download folder:', err);
                }
            }

            // 3. Build response message
            let responseText = '🗑️ *CLEAR SESSION*\n\n';

            if (deletedFiles.length > 0) {
                responseText += `✅ Berhasil menghapus ${deletedFiles.length} file:\n\n`;

                // Group by type
                const playerScripts = deletedFiles.filter(f => f.includes('player-script'));
                const downloads = deletedFiles.filter(f => f.includes('download/'));

                if (playerScripts.length > 0) {
                    responseText += `📄 Player Scripts: ${playerScripts.length} file\n`;
                }
                if (downloads.length > 0) {
                    responseText += `📹 Download Cache: ${downloads.length} file\n`;
                }

                responseText += '\n✨ Session berhasil dibersihkan!';
            } else {
                responseText += '✨ Session sudah bersih, tidak ada file yang perlu dihapus.';
            }

            if (errors.length > 0) {
                responseText += `\n\n⚠️ Beberapa file gagal dihapus:\n`;
                errors.slice(0, 3).forEach(err => {
                    responseText += `• ${err}\n`;
                });
                if (errors.length > 3) {
                    responseText += `• ... dan ${errors.length - 3} lainnya\n`;
                }
            }

            await sock.sendMessage(from, { text: responseText }, { quoted: msg });
            await sock.sendMessage(from, {
                react: { text: '✅', key: msg.key }
            });

        } catch (err) {
            console.error('[ClearSesi] Fatal error:', err);

            await sock.sendMessage(from, {
                react: { text: '❌', key: msg.key }
            });

            await sock.sendMessage(from, {
                text: `❌ Gagal membersihkan session!\n\n⚠️ Error: ${err.message}`
            }, { quoted: msg });
        }
    }
};
