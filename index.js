import "./env.js";
import "./utils/fontSetupInit.js";
import {
    makeWASocket,
    fetchLatestBaileysVersion,
    DisconnectReason
} from "baileys";
import { useMultiFileAuthStateSync } from "./utils/authSync.js";

import P from "pino";
import chalk from "chalk";
import readline from "readline";
import fs from "fs";
import path from "path";
import handleMessage from "./handler/message.js";
import handleGroupParticipantsUpdate from "./handler/group.js";
import { setupYtdlp } from "./utils/ytdlpSetup.js";
import { startReminderScheduler } from "./Lib/reminder_manager.js";
import "./Lib/autodl_manager.js"; // Initialize AutoDL state on startup
import "./Lib/antidelete_manager.js"; // Initialize AntiDelete state on startup

// Flag to prevent restart loop during pairing
let isPairing = false;
let isShuttingDown = false;
let consecutive401Count = 0;

// Handle process shutdown signals gracefully to avoid auth conflict/deletion
const handleShutdown = (signal) => {
    console.log(chalk.yellow(`\n⚠️  Received ${signal}. Setting shutdown flag to true...`));
    isShuttingDown = true;
    process.exit(0);
};

process.once("SIGINT", () => handleShutdown("SIGINT"));
process.once("SIGTERM", () => handleShutdown("SIGTERM"));
process.once("SIGUSR2", () => handleShutdown("SIGUSR2"));

// ================== (2) & (3) Sudah Digabung di Fungsi Ini ==================
async function ask(text) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve =>
        rl.question(text, ans => {
            rl.close();
            resolve(ans);
        })
    );
}
// ===========================================================================

async function startBot() {

    // Setup yt-dlp binary
    global.ytdlpPath = await setupYtdlp();

    // ============ BAGIAN 2: Auth State (Database or Synchronous Local File) =============
    const authDir = process.env.AUTH_DIR || './auth';
    let authState;
    const hasDb = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
    
    if (hasDb) {
        try {
            const { getDatabaseAuthState } = await import('./utils/authDb.js');
            authState = await getDatabaseAuthState('main');
        } catch (dbErr) {
            console.error('[AuthDB] Failed to load database auth state, falling back to local files:', dbErr);
        }
    }
    
    if (!authState) {
        authState = useMultiFileAuthStateSync(authDir);
    }
    
    const { state, saveCreds } = authState;
    // ====================================================================================

    const { version } = await fetchLatestBaileysVersion();
    console.log(chalk.yellow("Using WhatsApp v" + version.join(".")));

    const sock = makeWASocket({
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: P({ level: "silent" }),
        version,
        // Opsi optimal untuk menstabilkan sesi Bot Utama:
        syncFullHistory: false,
        shouldSyncHistoryDevices: () => false,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    global.waSock = sock; // Expose WhatsApp socket globally for bot integrations

    sock.userbotGl = true; // Automatically enable Global Listener for main bot/owner

    // Save credentials
    sock.ev.on("creds.update", saveCreds);

    // Connection handler
    sock.ev.on("connection.update", (update) => {
        const { connection } = update;

        if (connection === "open") {
            console.log(chalk.green("Bot berhasil connect ✔️"));
            isPairing = false; // Reset flag
            consecutive401Count = 0; // Reset 401 counter
            startReminderScheduler(sock);
            
            // Load and initialize active confess sessions from disk
            try {
                import('./Lib/confess_manager.js').then(({ initConfessSessions }) => {
                    initConfessSessions(sock).catch(err => {
                        console.error('[Confess] initConfessSessions error:', err);
                    });
                });
            } catch (err) {
                console.error('[Confess] Import initConfessSessions failed:', err);
            }

            // Initialize active multi-userbots
            try {
                import('./Lib/userbot_manager.js').then(({ initUserbots }) => {
                    initUserbots(sock).catch(err => {
                        console.error('[Userbot] initUserbots error:', err);
                    });
                });
            } catch (err) {
                console.error('[Userbot] Import initUserbots failed:', err);
            }
        } else if (connection === "close") {
            if (isShuttingDown) {
                console.log(chalk.yellow("🔌 Connection closed due to process shutdown/restart. Skipping reconnection & session cleanup."));
                return;
            }

            const errorReason = update.lastDisconnect?.error;
            const statusCode = errorReason?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.error(chalk.red(`⚠️  Connection Closed (Status Code: ${statusCode}):`), errorReason);

            if (shouldReconnect) {
                // If connection replaced (conflict), wait 10 seconds to let the other instance stop.
                const delay = statusCode === DisconnectReason.connectionReplaced ? 10000 : 3000;
                console.log(chalk.red(`Koneksi terputus. Mencoba menghubungkan kembali dalam ${delay/1000} detik...`));
                setTimeout(() => startBot(), delay);
            } else {
                console.log(chalk.red(`\n❌ Sesi terkonfirmasi telah dikeluarkan (Logged Out) secara permanen.`));
                
                const exitProcess = () => {
                    console.log(chalk.yellow(`💡 Menghapus file sesi di '${authDir}'...`));
                    try {
                        if (fs.existsSync(authDir)) {
                            const files = fs.readdirSync(authDir);
                            for (const file of files) {
                                if (file !== 'blacklist.json' && file !== 'self_mode.json') {
                                    const filePath = path.join(authDir, file);
                                    const stat = fs.statSync(filePath);
                                    if (stat.isDirectory()) {
                                        fs.rmSync(filePath, { recursive: true, force: true });
                                    } else {
                                        fs.unlinkSync(filePath);
                                    }
                                }
                            }
                        }
                        console.log(chalk.green("✅ File sesi berhasil dihapus."));
                    } catch (err) {
                        console.error("Gagal menghapus folder sesi:", err);
                    }
                    console.log(chalk.yellow("💡 Silakan jalankan ulang bot untuk pairing baru.\n"));
                    process.exit(0);
                };

                if (hasDb) {
                    import('./utils/authDb.js').then(({ clearDatabaseSession }) => {
                        clearDatabaseSession('main').then(() => {
                            console.log(chalk.green("✅ Kredensial di database berhasil dibersihkan."));
                            exitProcess();
                        }).catch(dbErr => {
                            console.error("Gagal membersihkan database auth:", dbErr);
                            exitProcess();
                        });
                    }).catch(importErr => {
                        console.error("Gagal mengimpor authDb.js:", importErr);
                        exitProcess();
                    });
                } else {
                    exitProcess();
                }
            }
        }
    });

    // ============ BAGIAN 3: Pairing Code (Headless & PM2 Compatible) ============
    if (!sock.authState.creds.registered && !sock.authState.creds.me) {
        const envPhoneNumber = process.env.PAIRING_NUMBER || process.env.BOT_NUMBER;
        const isInteractive = process.stdin.isTTY;

        if (isInteractive || envPhoneNumber) {
            isPairing = true; // Set flag to true to prevent auto-restart loop

            let phoneNumber = envPhoneNumber;
            if (!phoneNumber && isInteractive) {
                phoneNumber = await ask(chalk.cyan("Masukkan nomor BOT (62xxx): "));
            }

            if (phoneNumber) {
                const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
                console.log(chalk.yellow(`\n⏳ Requesting pairing code untuk nomor: ${cleanPhone}...`));

                // Request pairing code immediately (wait for socket init)
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(cleanPhone);
                        console.log(chalk.green("\n==========================================="));
                        console.log(chalk.green("PAIRING CODE: " + code));
                        console.log(chalk.green("===========================================\n"));
                        console.log(chalk.yellow("Masukkan code ini ke WhatsApp:"));
                        console.log(chalk.yellow("1. Buka WhatsApp di HP"));
                        console.log(chalk.yellow("2. Tap Menu > Linked Devices"));
                        console.log(chalk.yellow("3. Tap 'Link a Device'"));
                        console.log(chalk.yellow("4. Tap 'Link with phone number instead'"));
                        console.log(chalk.yellow(`5. Masukkan code: ${code}\n`));

                        // Write to file
                        try {
                            fs.writeFileSync("pairing_code.txt", code);
                            console.log(chalk.green("✅ Code juga disimpan di pairing_code.txt\n"));
                        } catch (e) {
                            console.error("Gagal tulis file pairing_code.txt", e);
                        }
                    } catch (err) {
                        console.error(chalk.red("❌ Gagal request pairing code:"), err.message);
                        isPairing = false; // Allow restart if request failed
                    }
                }, 6000); // 6s delay for socket readiness
            } else {
                console.log(chalk.red("❌ Nomor telepon tidak dimasukkan!"));
                process.exit(1);
            }
        } else {
            console.log(chalk.red(`⚠️  Bot belum login!`));
            console.log(chalk.yellow(`💡 Jalankan bot secara manual untuk input nomor pairing:`));
            console.log(chalk.cyan(`   node index.js`));
            console.log(chalk.yellow(`\nAtau atur environment variable PAIRING_NUMBER untuk pairing headless di Railway/Pterodactyl.`));
            process.exit(1);
        }
    }
    // ===================================================================
    // ===================================================================

    // Pesan masuk → handler
    sock.ev.on("messages.upsert", async (msg) => {
        try {
            const m = msg.messages[0];
            if (m && m.message && !m.key.fromMe) {
                const { cacheMessage, handleDelete } = await import('./Lib/userbot_manager.js');
                await cacheMessage(sock, m);
                await handleDelete(sock, m);

                // Anti-Delete: cache pesan masuk & deteksi revoke (kirim ke nomor bot sendiri)
                const { adCacheMessage, adHandleRevoke } = await import('./Lib/antidelete_manager.js');
                adCacheMessage(m);
                await adHandleRevoke(sock, m); // default target = 'self'
            }
            await handleMessage(sock, msg);
        } catch (err) {
            console.error("Handler Error:", err);
        }
    });

    // Group Participants Update (Welcome/Leave)
    sock.ev.on("group-participants.update", async (update) => {
        try {
            await handleGroupParticipantsUpdate(sock, update);
        } catch (err) {
            console.error("Group Update Error:", err);
        }
    });
}

startBot();

// Start Telegram Bot in parallel inside the same process
import("./telegram.js").catch(err => {
    console.error("❌ Failed to start Telegram bot:", err);
});

// Start Discord Bot in parallel inside the same process
import("./discord.js").catch(err => {
    console.error("❌ Failed to start Discord bot:", err);
});