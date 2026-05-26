import {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from "baileys";

import P from "pino";
import chalk from "chalk";
import readline from "readline";
import fs from "fs";
import handleMessage from "./handler/message.js";
import handleGroupParticipantsUpdate from "./handler/group.js";
import "./Lib/autodl_manager.js"; // Initialize AutoDL state on startup

// Flag to prevent restart loop during pairing
let isPairing = false;

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

    // ============ BAGIAN 2: Auth State yang bener =============
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    // ===========================================================

    const { version } = await fetchLatestBaileysVersion();
    console.log(chalk.yellow("Using WhatsApp v" + version.join(".")));

    const sock = makeWASocket({
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: P({ level: "silent" }),
        version
    });

    // Save credentials
    sock.ev.on("creds.update", saveCreds);

    // Connection handler
    sock.ev.on("connection.update", (update) => {
        const { connection } = update;

        if (connection === "open") {
            console.log(chalk.green("Bot berhasil connect ✔️"));
            isPairing = false; // Reset flag
        } else if (connection === "close") {
            const shouldReconnect = (update.lastDisconnect?.error)?.output?.statusCode !== 401;
            const errorReason = update.lastDisconnect?.error;

            console.error(chalk.red("⚠️  Connection Closed:"), errorReason);

            // Don't auto-restart if we're in pairing mode AND it's a fatal error (like 401)
            // But if it's just a network glitch, we should probably try again or keep the process alive
            if (!isPairing || shouldReconnect) {
                console.log(chalk.red("Koneksi putus, mencoba lagi..."));
                setTimeout(() => startBot(), 3000);
            } else {
                console.log(chalk.red("\n❌ Koneksi gagal saat pairing/pairing selesai."));
                console.log(chalk.yellow("💡 Jika pairing berhasil, jalankan ulang: node index.js"));
                console.log(chalk.yellow("💡 Jika gagal, hapus folder 'auth' dan coba lagi.\n"));
                process.exit(0);
            }
        }
    });

    // ============ BAGIAN 3: Pairing Code (PM2 Compatible) ============
    if (!sock.authState.creds.registered) {
        const isInteractive = process.stdin.isTTY;

        if (isInteractive) {
            isPairing = true; // Set flag to true to prevent auto-restart loop

            // Ask for phone number
            const phoneNumber = await ask(chalk.cyan("Masukkan nomor BOT (62xxx): "));

            console.log(chalk.yellow("\n⏳ Requesting pairing code..."));

            // Request pairing code immediately (wait for socket init)
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber.trim());
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
            console.log(chalk.red(`⚠️  Bot belum login!`));
            console.log(chalk.yellow(`💡 Jalankan bot secara manual untuk input nomor pairing:`));
            console.log(chalk.cyan(`   node index.js`));
            console.log(chalk.yellow(`\nAtau hapus folder 'auth' dan restart PM2.`));
            process.exit(1);
        }
    }
    // ===================================================================

    // Pesan masuk → handler
    sock.ev.on("messages.upsert", async (msg) => {
        try {
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