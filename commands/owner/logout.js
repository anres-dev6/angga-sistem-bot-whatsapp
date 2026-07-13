import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: 'logout',
    aliases: ['logoutbot', 'keluar'],
    tags: ['owner'],
    description: 'Manual logout bot and clear main session',
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
                text: "👋 Sesi bot akan dikeluarkan secara permanen dan file sesi akan dihapus. Menutup koneksi..."
            }, { quoted: msg });

            // 1. Tell WhatsApp server we are logging out (invalidates session JID)
            try {
                await sock.logout();
            } catch (err) {
                console.error('[Logout] error calling sock.logout():', err.message);
            }

            // 2. Clear database session if configured
            const hasDb = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
            if (hasDb) {
                try {
                    const { clearDatabaseSession } = await import('../../utils/authDb.js');
                    await clearDatabaseSession('main');
                    console.log('[Logout] Database session cleared successfully.');
                } catch (dbErr) {
                    console.error('[Logout] Failed to clear database session:', dbErr.message);
                }
            }

            // 3. Clear credentials directory
            const authDir = process.env.AUTH_DIR || './auth';
            console.log(`[Logout] Clearing session directory: ${authDir}`);
            if (fs.existsSync(authDir)) {
                const files = fs.readdirSync(authDir);
                for (const file of files) {
                    if (file !== 'blacklist.json' && file !== 'self_mode.json') {
                        const filePath = path.join(authDir, file);
                        try {
                            const stat = fs.statSync(filePath);
                            if (stat.isDirectory()) {
                                fs.rmSync(filePath, { recursive: true, force: true });
                            } else {
                                fs.unlinkSync(filePath);
                            }
                            console.log(`[Logout] Deleted: ${file}`);
                        } catch (err) {
                            console.error(`[Logout] Failed to delete ${file}:`, err.message);
                        }
                    }
                }
            }

            console.log('[Logout] Session cleared successfully. Exiting process...');
            setTimeout(() => {
                process.exit(0);
            }, 1000);

        } catch (err) {
            console.error('[Logout] Error during manual logout:', err);
            await sock.sendMessage(from, {
                text: `❌ Gagal logout secara bersih!\n\n⚠️ Error: ${err.message}`
            }, { quoted: msg });
        }
    }
};
