import {
    makeWASocket,
    useMultiFileAuthState
} from "baileys";
import P from "pino";
import fs from "fs";

function logToFile(msg) {
    console.log(msg);
    try {
        fs.appendFileSync("pairing_code.txt", msg + "\n");
    } catch (e) { }
}

async function startLogin() {
    logToFile("Starting login script...");

    try {
        logToFile("Loading auth...");
        const { state, saveCreds } = await useMultiFileAuthState('./auth');

        // Hardcoded version from previous logs to avoid fetch hang
        const version = [2, 3000, 1015901307];
        logToFile("Using WhatsApp v" + version.join("."));

        const sock = makeWASocket({
            auth: state,
            logger: P({ level: "silent" }),
            version,
            // connectTimeoutMs: 60000, // Extend timeout
            // defaultQueryTimeoutMs: 0,
        });

        if (!sock.authState.creds.registered) {
            logToFile("Requesting pairing code for 6285708950373...");
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode("6285708950373");
                    logToFile("\n===========================================");
                    logToFile("PAIRING CODE: " + code);
                    logToFile("===========================================\n");
                } catch (err) {
                    logToFile("Failed to request code: " + err.message);
                }
            }, 5000); // 5s delay to ensure connection
        } else {
            logToFile("Already registered!");
        }

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "open") {
                logToFile("Login Success!");
                process.exit(0);
            } else if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                logToFile("Connection closed. Reason: " + reason);
            }
        });
    } catch (error) {
        logToFile("Critical Error: " + error.message);
    }
}

startLogin();
