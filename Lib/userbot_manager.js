import {
    makeWASocket,
    fetchLatestBaileysVersion,
    downloadMediaMessage,
    DisconnectReason
} from "baileys";
import { useMultiFileAuthStateSync } from "../utils/authSync.js";
import P from "pino";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import handleMessage from "../handler/message.js";
import { loadOwners } from "../utils/security.js";

const USERBOTS_FILE = "./data/userbots.json";
const CACHE_DIRS = [
    './cache/messages',
    './cache/media',
    './cache/viewonce',
    './cache/status'
];

// In-memory registry of active userbot sockets
global.userbotSockets = global.userbotSockets || new Map();
global.groupMetadataCache = global.groupMetadataCache || new Map();
const userbot401Counts = new Map();

// Helper to ensure database and cache directories exist
function initStorage() {
    const dataDir = path.dirname(USERBOTS_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(USERBOTS_FILE)) {
        fs.writeFileSync(USERBOTS_FILE, JSON.stringify([], null, 2));
    }
    for (const dir of CACHE_DIRS) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

// Read database
export function loadUserbots() {
    initStorage();
    try {
        const data = fs.readFileSync(USERBOTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[Userbot Manager] Failed to load userbots JSON:', err);
        return [];
    }
}

// Write database
export function saveUserbots(userbots) {
    initStorage();
    try {
        fs.writeFileSync(USERBOTS_FILE, JSON.stringify(userbots, null, 2));
        return true;
    } catch (err) {
        console.error('[Userbot Manager] Failed to save userbots JSON:', err);
        return false;
    }
}

// Auto Cleanup for Cache files older than 24 hours
export function startCacheCleanup() {
    setInterval(() => {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const dir of CACHE_DIRS) {
            if (!fs.existsSync(dir)) continue;
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > maxAge) {
                        fs.unlinkSync(filePath);
                        console.log(`[Cache Cleanup] Deleted expired cache file: ${filePath}`);
                    }
                }
            } catch (err) {
                console.error(`[Cache Cleanup] Error cleaning up dir ${dir}:`, err.message);
            }
        }
    }, 60 * 60 * 1000); // Check every hour
}

// Start auto cleanup on module load
initStorage();
startCacheCleanup();

// Helper to check if a message structure is View Once
function checkIfViewOnce(message) {
    if (!message) return false;
    if (message.viewOnceMessage || message.viewOnceMessageV2 || message.viewOnceMessageV2Extension) return true;
    if (message.ephemeralMessage) {
        return checkIfViewOnce(message.ephemeralMessage.message);
    }
    if (message.documentWithCaptionMessage) {
        return checkIfViewOnce(message.documentWithCaptionMessage.message);
    }
    return false;
}

// Helper to unwrap ephemeral, viewOnce, or other wrappers to get the core message content
function getUnwrappedMessage(message) {
    if (!message) return null;
    if (message.ephemeralMessage) {
        return getUnwrappedMessage(message.ephemeralMessage.message);
    }
    if (message.documentWithCaptionMessage) {
        return getUnwrappedMessage(message.documentWithCaptionMessage.message);
    }
    if (message.viewOnceMessage) {
        return getUnwrappedMessage(message.viewOnceMessage.message);
    }
    if (message.viewOnceMessageV2) {
        return getUnwrappedMessage(message.viewOnceMessageV2.message);
    }
    if (message.viewOnceMessageV2Extension) {
        return getUnwrappedMessage(message.viewOnceMessageV2Extension.message);
    }
    return message;
}

// Deep recursive scanner to search and extract media messages within a WhatsApp message tree.
function findMediaMessage(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const mediaTypes = [
        'viewOnceMessage',
        'viewOnceMessageV2',
        'viewOnceMessageV2Extension',
        'ephemeralMessage',
        'imageMessage',
        'videoMessage',
        'documentMessage',
        'stickerMessage',
        'audioMessage'
    ];
    for (const type of mediaTypes) {
        if (obj[type]) {
            const nested = obj[type];
            if (['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'ephemeralMessage'].includes(type)) {
                const subMsg = nested.message || nested;
                const result = findMediaMessage(subMsg);
                if (result) return result;
            } else {
                if (nested.mediaKey || nested.directPath || nested.url) {
                    return { type, message: nested };
                }
            }
        }
    }
    for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === 'object' && key !== 'contextInfo') {
            const result = findMediaMessage(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

// Download and cache media content using Baileys built-in downloader as main Strategy
async function cacheMessageMedia(sock, m, mediaMsg, mediaType, cacheDir) {
    const msgId = m.key.id;
    try {
        let buffer;
        try {
            buffer = await downloadMediaMessage(
                m,
                'buffer',
                {},
                {
                    logger: P({ level: "silent" }),
                    reuploadRequest: sock.updateMediaMessage
                }
            );
        } catch (e) {
            try {
                buffer = await downloadMediaMessage(
                    {
                        key: m.key,
                        message: { [mediaType]: mediaMsg }
                    },
                    'buffer',
                    {},
                    {
                        logger: P({ level: "silent" }),
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
            } catch (e2) {
                buffer = await downloadMediaMessage(
                    {
                        key: m.key,
                        message: mediaMsg
                    },
                    'buffer',
                    {},
                    {
                        logger: P({ level: "silent" }),
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
            }
        }

        if (buffer) {
            const ext = mediaMsg.mimetype ? mediaMsg.mimetype.split('/')[1]?.split(';')[0] || 'bin' : 'bin';
            const filePath = path.join(cacheDir, `${msgId}.${ext}`);
            fs.writeFileSync(filePath, buffer);
            return filePath;
        }
    } catch (err) {
        console.error(`[Cache Media] Error caching media for ${msgId}:`, err.message);
    }
    return null;
}

// Cache message metadata
function saveMessageMetadata(msgId, metadata) {
    const filePath = path.join('./cache/messages', `${msgId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
}

function getMessageMetadata(msgId) {
    const filePath = path.join('./cache/messages', `${msgId}.json`);
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error('Failed to parse cached message metadata:', e);
        }
    }
    return null;
}

// Handle View Once messages
async function handleViewOnce(sock, m, senderNumber, from, chatName) {
    try {
        const unwrapped = getUnwrappedMessage(m.message);
        if (!unwrapped) return;

        const resolved = findMediaMessage(unwrapped);
        if (!resolved) return;

        const mediaType = resolved.type;
        const mediaMessage = resolved.message;
        const mimeType = mediaMessage.mimetype || '';
        const captionText = mediaMessage.caption || '';

        // Cache path
        const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
        const cachePath = path.join('./cache/viewonce', `${m.key.id}.${ext}`);

        let buffer = null;
        try {
            buffer = await downloadMediaMessage(
                m,
                'buffer',
                {},
                {
                    logger: P({ level: 'silent' }),
                    reuploadRequest: sock.updateMediaMessage
                }
            );
        } catch (e) {
            try {
                buffer = await downloadMediaMessage(
                    {
                        key: m.key,
                        message: unwrapped
                    },
                    'buffer',
                    {},
                    {
                        logger: P({ level: 'silent' }),
                        reuploadRequest: sock.updateMediaMessage
                    }
                );
            } catch (err) {
                console.error('Failed to download View Once buffer:', err);
            }
        }

        if (!buffer) return;

        fs.writeFileSync(cachePath, buffer);

        const selfJid = sock.user?.id 
            ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') 
            : (sock.userbotNumber ? (sock.userbotNumber + '@s.whatsapp.net') : null);

        if (!selfJid) return;

        const owners = loadOwners();
        const targetJid = sock.isUserbot ? selfJid : (owners[0] ? owners[0] + '@s.whatsapp.net' : selfJid);
        const textOutput = `[GL • VIEW ONCE SAVED]\n` +
                           `Pengirim: @${senderNumber}\n` +
                           `Di: ${chatName}` +
                           (captionText ? `\nCaption: ${captionText}` : '');

        const senderJid = (m.key.participant || m.key.remoteJid || '').split(':')[0] + '@s.whatsapp.net';
        const mediaOptions = {
            caption: textOutput,
            mentions: [senderJid]
        };

        if (mimeType.includes('image') || mediaType === 'imageMessage') {
            mediaOptions.image = buffer;
        } else if (mimeType.includes('video') || mediaType === 'videoMessage') {
            mediaOptions.video = buffer;
        } else {
            mediaOptions.document = buffer;
            mediaOptions.mimetype = mimeType;
            mediaOptions.fileName = `viewonce_${Date.now()}.${ext}`;
        }

        await sock.sendMessage(targetJid, mediaOptions);

        // Also save metadata for deletion restore
        const metadata = {
            id: m.key.id,
            sender: m.key.participant || m.key.remoteJid || from,
            senderNumber,
            from,
            chatName,
            text: captionText,
            caption: captionText,
            mediaPath: cachePath,
            mimetype: mimeType,
            type: mediaType,
            contextInfo: mediaMessage.contextInfo || null,
            createdAt: Date.now()
        };
        saveMessageMetadata(m.key.id, metadata);
    } catch (err) {
        console.error('[GL] Error handling view once message:', err);
    }
}
// Helper to retrieve group subject with caching
async function getGroupSubject(sock, jid) {
    const cacheKey = `${sock.userbotNumber || 'main'}_${jid}`;
    if (global.groupMetadataCache.has(cacheKey)) {
        const cached = global.groupMetadataCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30 * 60 * 1000) { // 30 minutes cache
            return cached.subject;
        }
    }
    try {
        const meta = await sock.groupMetadata(jid);
        const subject = meta.subject || 'Grup';
        global.groupMetadataCache.set(cacheKey, {
            subject,
            timestamp: Date.now()
        });
        return subject;
    } catch {
        return 'Grup';
    }
}

// Cache message entry point
export async function cacheMessage(sock, m) {
    if (!sock.userbotGl) return;
    if (m.message?.protocolMessage) return; // Skip protocol messages from caching

    const msgId = m.key.id;
    const remoteJid = m.key.remoteJid;
    if (!remoteJid) return;
    
    const isGroup = remoteJid.endsWith('@g.us');
    const isStatus = remoteJid === 'status@broadcast';
    const sender = (isGroup || isStatus) ? (m.key.participant || m.participant) : remoteJid;
    if (!sender) return;
    const senderNumber = sender.split('@')[0].split(':')[0].replace(/\D/g, '');

    let chatName = isGroup ? 'Grup' : 'Private Chat';
    if (isGroup) {
        chatName = await getGroupSubject(sock, remoteJid);
    } else if (isStatus) {
        chatName = 'Status';
    }

    const unwrapped = getUnwrappedMessage(m.message);
    if (!unwrapped) return;

    const isViewOnce = checkIfViewOnce(m.message);
    if (isViewOnce) {
        await handleViewOnce(sock, m, senderNumber, remoteJid, chatName);
        return;
    }

    let text = unwrapped.conversation ||
               unwrapped.extendedTextMessage?.text ||
               unwrapped.imageMessage?.caption ||
               unwrapped.videoMessage?.caption ||
               unwrapped.documentMessage?.caption ||
               unwrapped.buttonsMessage?.contentText ||
               unwrapped.templateMessage?.hydratedTemplate?.hydratedContentText ||
               unwrapped.interactiveMessage?.body?.text ||
               '';

    let contextInfo = unwrapped.extendedTextMessage?.contextInfo ||
                      unwrapped.imageMessage?.contextInfo ||
                      unwrapped.videoMessage?.contextInfo ||
                      unwrapped.documentMessage?.contextInfo ||
                      unwrapped.audioMessage?.contextInfo ||
                      unwrapped.stickerMessage?.contextInfo ||
                      null;

    const resolved = findMediaMessage(unwrapped);
    let mediaPath = null;
    let type = 'text';
    let mimetype = null;

    if (resolved) {
        type = resolved.type;
        mimetype = resolved.message.mimetype;
        const cacheDir = isStatus ? './cache/status' : './cache/media';
        mediaPath = await cacheMessageMedia(sock, m, resolved.message, type, cacheDir);
    }

    const metadata = {
        id: msgId,
        sender,
        senderNumber,
        from: remoteJid,
        chatName,
        text,
        caption: text,
        mediaPath,
        mimetype,
        type,
        contextInfo,
        gifPlayback: unwrapped.videoMessage?.gifPlayback || false,
        ptt: unwrapped.audioMessage?.ptt || false,
        createdAt: Date.now()
    };

    saveMessageMetadata(msgId, metadata);
}

// Handle message deletions (REVOKE)
export async function handleDelete(sock, m) {
    if (!sock.userbotGl) return;

    try {
        const unwrapped = getUnwrappedMessage(m.message);
        const protocolMsg = unwrapped?.protocolMessage;
        if (!protocolMsg || (protocolMsg.type !== 3 && protocolMsg.type !== 'REVOKE')) return;

        const targetId = protocolMsg.key.id;
        const metadata = getMessageMetadata(targetId);
        if (!metadata) return;

        let deleter = m.key.participant || m.participant || m.key.remoteJid;
        if ((!deleter || deleter === 'status@broadcast') && metadata) {
            deleter = metadata.sender;
        }

        const deleterNumber = deleter ? deleter.split('@')[0].split(':')[0].replace(/\D/g, '') : '';
        const deleterJid = deleterNumber ? (deleterNumber + '@s.whatsapp.net') : null;
        const selfJid = sock.user?.id 
            ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') 
            : (sock.userbotNumber ? (sock.userbotNumber + '@s.whatsapp.net') : null);

        if (!selfJid) return;

        const owners = loadOwners();
        const targetJid = sock.isUserbot ? selfJid : (owners[0] ? owners[0] + '@s.whatsapp.net' : selfJid);
        const mentions = deleterJid ? [deleterJid] : [];

        if (metadata.from === 'status@broadcast') {
            const age = Date.now() - metadata.createdAt;
            if (age >= 24 * 60 * 60 * 1000) return; // Ignore if manual delete is 24h or later (status expired normally)

            const textOutput = `[GL • STATUS DELETED]\n` +
                               `Penghapus: @${deleterNumber}`;

            const sendOptions = {
                caption: textOutput,
                mentions: mentions
            };

            if (metadata.mediaPath && fs.existsSync(metadata.mediaPath)) {
                const buffer = fs.readFileSync(metadata.mediaPath);
                if (metadata.mimetype?.includes('image')) {
                    sendOptions.image = buffer;
                } else if (metadata.mimetype?.includes('video')) {
                    sendOptions.video = buffer;
                    if (metadata.gifPlayback) {
                        sendOptions.gifPlayback = true;
                    }
                } else {
                    sendOptions.document = buffer;
                    sendOptions.mimetype = metadata.mimetype;
                    sendOptions.fileName = path.basename(metadata.mediaPath);
                }
                await sock.sendMessage(targetJid, sendOptions);
            } else if (metadata.text) {
                await sock.sendMessage(targetJid, {
                    text: `${textOutput}\n\n*Status text:*\n${metadata.text}`,
                    mentions: mentions
                });
            } else {
                await sock.sendMessage(targetJid, {
                    text: `${textOutput}\n\n*Status:*\n(Tipe: ${metadata.type || 'unknown'})`,
                    mentions: mentions
                });
            }
        } else {
            const textOutput = `[GL • MESSAGE RESTORED]\n` +
                               `Penghapus: @${deleterNumber}\n` +
                               `Di: ${metadata.chatName}` +
                               (metadata.caption ? `\nCaption: ${metadata.caption}` : '');

            const sendOptions = {
                caption: textOutput,
                mentions: mentions
            };

            if (metadata.mediaPath && fs.existsSync(metadata.mediaPath)) {
                const buffer = fs.readFileSync(metadata.mediaPath);
                const type = metadata.type;
                const mime = metadata.mimetype || '';

                if (mime.includes('image') || type === 'imageMessage') {
                    sendOptions.image = buffer;
                    await sock.sendMessage(targetJid, sendOptions);
                } else if (mime.includes('video') || type === 'videoMessage') {
                    sendOptions.video = buffer;
                    if (metadata.gifPlayback) {
                        sendOptions.gifPlayback = true;
                    }
                    await sock.sendMessage(targetJid, sendOptions);
                } else if (mime.includes('sticker') || type === 'stickerMessage') {
                    await sock.sendMessage(targetJid, { sticker: buffer });
                    await sock.sendMessage(targetJid, { text: textOutput, mentions: mentions });
                } else if (mime.includes('audio') || type === 'audioMessage') {
                    await sock.sendMessage(targetJid, { audio: buffer, mimetype: mime, ptt: metadata.ptt || false });
                    await sock.sendMessage(targetJid, { text: textOutput, mentions: mentions });
                } else {
                    sendOptions.document = buffer;
                    sendOptions.mimetype = mime;
                    sendOptions.fileName = path.basename(metadata.mediaPath);
                    await sock.sendMessage(targetJid, sendOptions);
                }
            } else if (metadata.text) {
                await sock.sendMessage(targetJid, {
                    text: `${textOutput}\n\n*Pesan:*\n${metadata.text}`,
                    mentions: mentions
                });
            } else {
                await sock.sendMessage(targetJid, {
                    text: `${textOutput}\n\n*Pesan:*\n(Tipe: ${metadata.type || 'unknown'})`,
                    mentions: mentions
                });
            }
        }
    } catch (err) {
        console.error('[GL] Error handling message deletion:', err);
    }
}

// Connect and bootstrap userbot instance
export async function startUserbotConnection(userbotInfo, mainSock = null) {
    const { number, features, gl, owner } = userbotInfo;
    const sessionDir = `./sessions/userbots/${number}`;

    console.log(chalk.cyan(`[Userbot Manager] Starting userbot session for ${number}...`));

    let authState;
    const hasDb = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
    if (hasDb) {
        try {
            const { getDatabaseAuthState } = await import('../utils/authDb.js');
            authState = await getDatabaseAuthState(`userbot_${number}`);
        } catch (dbErr) {
            console.error(`[Userbot Manager] Failed to load database auth state for userbot ${number}, falling back:`, dbErr);
        }
    }

    if (!authState) {
        authState = useMultiFileAuthStateSync(sessionDir);
    }

    const { state, saveCreds } = authState;
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: P({ level: "silent" }),
        version
    });

    sock.isUserbot = true;
    sock.userbotNumber = number;
    sock.userbotCreator = owner;
    sock.userbotFeatures = features || [];
    sock.userbotGl = gl !== false;

    global.userbotSockets.set(number, sock);

    sock.ev.on("creds.update", saveCreds);

    return new Promise((resolve, reject) => {
        let resolved = false;

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {
                console.log(chalk.green(`[Userbot Manager] Userbot +${number} connected successfully ✔️`));
                userbot401Counts.set(number, 0); // Reset 401 counter
                
                // Update pairing status in database
                const db = loadUserbots();
                const idx = db.findIndex(b => b.number === number);
                let isNewConnection = false;
                if (idx > -1) {
                    if (!db[idx].paired) {
                        isNewConnection = true;
                    }
                    db[idx].paired = true;
                    saveUserbots(db);
                }

                // Notify main owner ONLY if this is a new connection/pairing (not a reconnect)
                if (mainSock && isNewConnection) {
                    try {
                        const owners = db[idx]?.owner ? [db[idx].owner] : [];
                        const jid = owners[0] ? `${owners[0]}@s.whatsapp.net` : mainSock.user.id.split(':')[0] + '@s.whatsapp.net';
                        await mainSock.sendMessage(jid, {
                            text: `BOT CONNECTED\n` +
                                  `Nomor: +${number}\n` +
                                  `Fitur: ${features.join(', ') || 'tidak ada'}\n` +
                                  `Aturan: tidak otomatis mendapat semua fitur, session terpisah, reconnect otomatis, support multi userbot`
                        });
                    } catch (e) {
                        console.error('Failed to notify connection to owner:', e);
                    }
                }

                resolved = true;
                resolve({ success: true, socket: sock });

            } else if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(chalk.yellow(`[Userbot Manager] Userbot +${number} connection closed. Status Code: ${statusCode}`));

                if (shouldReconnect) {
                    const delay = statusCode === DisconnectReason.connectionReplaced ? 10000 : 5000;
                    console.log(chalk.yellow(`[Userbot Manager] Reconnecting userbot +${number} in ${delay/1000}s...`));
                    setTimeout(() => startUserbotConnection(userbotInfo, mainSock), delay);
                } else {
                    const currentCount = (userbot401Counts.get(number) || 0) + 1;
                    userbot401Counts.set(number, currentCount);

                    console.log(chalk.yellow(`[Userbot Manager] Userbot +${number} connection closed with 401 (logged out). Attempt ${currentCount}/4`));

                    if (currentCount < 4) {
                        console.log(chalk.yellow(`[Userbot Manager] Retrying connection for userbot +${number} in 30 seconds...`));
                        setTimeout(() => startUserbotConnection(userbotInfo, mainSock), 30000);
                    } else {
                        console.log(chalk.red(`[Userbot Manager] Userbot +${number} credentials confirmed logged out. Deleting session files.`));
                        userbot401Counts.set(number, 0); // Reset counter
                        
                        // Mark as unpaired
                        const db = loadUserbots();
                        const idx = db.findIndex(b => b.number === number);
                        if (idx > -1) {
                            db[idx].paired = false;
                            saveUserbots(db);
                        }

                        global.userbotSockets.delete(number);

                        // Delete session database if configured
                        const hasDb = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
                        if (hasDb) {
                            try {
                                const { clearDatabaseSession } = await import('../utils/authDb.js');
                                await clearDatabaseSession(`userbot_${number}`);
                                console.log(`[Userbot Manager] Cleared session database for userbot_${number}`);
                            } catch (e) {
                                console.error(`[Userbot Manager] Failed to clear session database for userbot_${number}:`, e.message);
                            }
                        }

                        // Delete session files
                        const sessionDir = `./sessions/userbots/${number}`;
                        if (fs.existsSync(sessionDir)) {
                            try {
                                fs.rmSync(sessionDir, { recursive: true, force: true });
                                console.log(`[Userbot Manager] Deleted session directory: ${sessionDir}`);
                            } catch (e) {
                                console.error(`[Userbot Manager] Failed to delete session dir ${sessionDir}:`, e.message);
                            }
                        }

                        // Notify main owner of disconnection
                        if (mainSock) {
                            try {
                                const owners = db[idx]?.owner ? [db[idx].owner] : [];
                                const jid = owners[0] ? `${owners[0]}@s.whatsapp.net` : mainSock.user.id.split(':')[0] + '@s.whatsapp.net';
                                await mainSock.sendMessage(jid, {
                                    text: `❌ *BOT DISCONNECTED*\nNomor: +${number}\nSebab: Sesi terputus (unauthorized)`
                                });
                            } catch (e) {
                                console.error(e);
                            }
                        }

                        if (!resolved) {
                            resolved = true;
                            reject(new Error("Connection unauthorized"));
                        }
                    }
                }
            }
        });

        sock.ev.on("messages.upsert", async (msg) => {
            try {
                const m = msg.messages[0];
                if (!m || !m.message) return;

                // Unwrap ephemeral/view-once wrapper to inspect content for prefix
                const unwrapped = m.message.ephemeralMessage?.message || 
                                  m.message.viewOnceMessage?.message || 
                                  m.message.viewOnceMessageV2?.message || 
                                  m.message.viewOnceMessageV2Extension?.message || 
                                  m.message.documentWithCaptionMessage?.message || 
                                  m.message;

                const body = (unwrapped?.conversation ||
                              unwrapped?.imageMessage?.caption ||
                              unwrapped?.videoMessage?.caption ||
                              unwrapped?.extendedTextMessage?.text ||
                              "").trim();

                const isCommand = body.startsWith('.') || 
                                  !!m.message?.listResponseMessage || 
                                  !!m.message?.buttonsResponseMessage || 
                                  !!m.message?.interactiveResponseMessage ||
                                  !!m.message?.templateButtonReplyMessage;

                // 1. Skip if message is from the userbot itself and is not a command
                if (m.key.fromMe && !isCommand) return;

                // 2. Global Listener hooks (for caching, view once and delete restoring)
                // Only for messages not sent by the bot itself
                if (sock.userbotGl && !m.key.fromMe) {
                    await cacheMessage(sock, m);
                    await handleDelete(sock, m);
                }

                // 3. Command router with feature restriction
                await handleMessage(sock, msg);

            } catch (err) {
                console.error(`[Userbot +${number}] Message handler error:`, err);
            }
        });

        // Request pairing code if not registered
        if (!sock.authState.creds.registered && !sock.authState.creds.me) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(number);
                    resolved = true;
                    resolve({ success: false, pairingCode: code });
                } catch (err) {
                    console.error(`[Userbot Manager] Request pairing code error for +${number}:`, err);
                    if (!resolved) {
                        resolved = true;
                        reject(err);
                    }
                }
            }, 6000); // delay to ensure socket readiness
        }
    });
}

// Initialize and auto-connect all registered userbots at main bot startup
export async function initUserbots(mainSock) {
    console.log(chalk.blue('[Userbot Manager] Initializing paired userbots...'));
    const userbots = loadUserbots();
    let count = 0;

    for (const userbot of userbots) {
        const sessionDir = `./sessions/userbots/${userbot.number}`;
        let hasSession = fs.existsSync(path.join(sessionDir, 'creds.json'));
        
        const hasDb = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
        if (!hasSession && hasDb) {
            try {
                const { hasDatabaseSession } = await import('../utils/authDb.js');
                hasSession = await hasDatabaseSession(`userbot_${userbot.number}`);
            } catch (dbErr) {
                console.error(`[Userbot Manager] Failed to check DB session for userbot ${userbot.number}:`, dbErr);
            }
        }

        if (userbot.paired || hasSession) {
            try {
                await startUserbotConnection(userbot, mainSock);
                count++;
            } catch (e) {
                console.error(`[Userbot Manager] Failed to load userbot +${userbot.number}:`, e.message);
            }
        }
    }
    console.log(chalk.green(`[Userbot Manager] Loaded and connected ${count} active userbot(s).`));
}

// Add a new userbot and generate pairing code
export async function addUserbot(number, features, ownerJid, mainSock) {
    const cleanedNumber = number.replace(/\D/g, '');
    const ownerNumber = ownerJid.split('@')[0].split(':')[0].replace(/\D/g, '');

    // Prevent adding the main bot's number as a userbot to avoid session conflict
    if (mainSock && mainSock.user) {
        const mainNumber = mainSock.user.id.split(':')[0].split('@')[0].replace(/\D/g, '');
        if (cleanedNumber === mainNumber) {
            throw new Error(`Tidak dapat menambahkan nomor bot utama (+${cleanedNumber}) sebagai userbot.`);
        }
    }

    const db = loadUserbots();
    let userbot = db.find(b => b.number === cleanedNumber);

    if (userbot && userbot.paired) {
        throw new Error(`Bot dengan nomor +${cleanedNumber} sudah terhubung.`);
    }

    if (!userbot) {
        userbot = {
            number: cleanedNumber,
            session: `session_${cleanedNumber}`,
            paired: false,
            owner: ownerNumber,
            features: features || [],
            gl: true,
            createdAt: Date.now()
        };
        db.push(userbot);
    } else {
        userbot.features = features || [];
        userbot.owner = ownerNumber;
        if (userbot.gl === undefined) {
            userbot.gl = true;
        }
    }
    saveUserbots(db);

    // Bootstrap connection and return pairing code
    return await startUserbotConnection(userbot, mainSock);
}

// Edit features of an existing userbot in real-time
export function editUserbotFeatures(number, featuresMod) {
    const cleanedSearch = number.replace(/\D/g, '');
    const db = loadUserbots();

    // Find bot (supports partial match/prefix matching)
    const userbot = db.find(b => b.number.startsWith(cleanedSearch) || b.number === cleanedSearch);

    if (!userbot) {
        throw new Error(`Bot dengan nomor matching +${cleanedSearch} tidak ditemukan.`);
    }

    const currentFeatures = new Set(userbot.features || []);

    for (const mod of featuresMod) {
        if (mod.startsWith('+')) {
            currentFeatures.add(mod.substring(1));
        } else if (mod.startsWith('-')) {
            currentFeatures.delete(mod.substring(1));
        } else {
            // default addition
            currentFeatures.add(mod);
        }
    }

    userbot.features = Array.from(currentFeatures);
    saveUserbots(db);

    // Update in-memory socket config if active
    const activeSock = global.userbotSockets.get(userbot.number);
    if (activeSock) {
        activeSock.userbotFeatures = userbot.features;
        console.log(`[Userbot Manager] Real-time features updated for +${userbot.number}:`, userbot.features);
    }

    return userbot;
}

// Remove/logout a userbot
export async function removeUserbot(number) {
    const cleanedSearch = number.replace(/\D/g, '');
    const db = loadUserbots();

    const idx = db.findIndex(b => b.number.startsWith(cleanedSearch) || b.number === cleanedSearch);
    if (idx === -1) {
        throw new Error(`Bot dengan nomor matching +${cleanedSearch} tidak ditemukan.`);
    }

    const userbot = db[idx];
    const fullNumber = userbot.number;

    // Logout and close socket if active
    const activeSock = global.userbotSockets.get(fullNumber);
    if (activeSock) {
        try {
            await activeSock.logout();
        } catch (e) {
            console.error(`[Userbot Manager] Logout error for +${fullNumber}:`, e.message);
        }
        try {
            activeSock.end();
        } catch (e) {}
        global.userbotSockets.delete(fullNumber);
    }

    // Remove database record
    db.splice(idx, 1);
    saveUserbots(db);

    // Delete session database if configured
    const hasDb = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL;
    if (hasDb) {
        try {
            const { clearDatabaseSession } = await import('../utils/authDb.js');
            await clearDatabaseSession(`userbot_${fullNumber}`);
            console.log(`[Userbot Manager] Cleared session database for userbot_${fullNumber}`);
        } catch (e) {
            console.error(`[Userbot Manager] Failed to clear session database for userbot_${fullNumber}:`, e.message);
        }
    }

    // Delete session files
    const sessionDir = `./sessions/userbots/${fullNumber}`;
    if (fs.existsSync(sessionDir)) {
        try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (e) {
            console.error(`[Userbot Manager] Failed to delete session dir ${sessionDir}:`, e.message);
        }
    }

    return fullNumber;
}

// Toggle Global Listener status
export function toggleUserbotGl(number, status) {
    const cleanedSearch = number.replace(/\D/g, '');
    const db = loadUserbots();

    const userbot = db.find(b => b.number.startsWith(cleanedSearch) || b.number === cleanedSearch);
    if (!userbot) {
        throw new Error(`Bot dengan nomor matching +${cleanedSearch} tidak ditemukan.`);
    }

    userbot.gl = !!status;
    saveUserbots(db);

    // Update in-memory socket config if active
    const activeSock = global.userbotSockets.get(userbot.number);
    if (activeSock) {
        activeSock.userbotGl = userbot.gl;
        console.log(`[Userbot Manager] Real-time GL status toggled for +${userbot.number}:`, userbot.gl);
    }

    return userbot;
}
