import path from "path";
import { fileURLToPath } from "url";
import { lastRiddle } from "../Lib/riddles.js";
import { getCommand, loadCommands } from "./command.js";
import fs from "fs";
import config from "../config.js";
import { loadOwners } from "../utils/security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMMAND_DIR = path.join(__dirname, "../commands");

// Initialize commands immediately
loadCommands(COMMAND_DIR);

// Cache autobans import for better performance
let autobansModule = null;
async function getAutobans() {
    if (!autobansModule) {
        autobansModule = await import('../commands/owner/autobans.js');
    }
    return autobansModule;
}

export default async function handleMessage(sock, msg) {
    try {
        const m = msg.messages[0];
        if (!m?.message) return;

        // Unwrap ephemeral and view-once message wrappers if they exist
        if (m.message.ephemeralMessage) {
            m.message = m.message.ephemeralMessage.message;
        }
        if (m.message?.viewOnceMessage) {
            m.message = m.message.viewOnceMessage.message;
        }
        if (m.message?.viewOnceMessageV2) {
            m.message = m.message.viewOnceMessageV2.message;
        }
        if (m.message?.viewOnceMessageV2Extension) {
            m.message = m.message.viewOnceMessageV2Extension.message;
        }
        if (m.message?.documentWithCaptionMessage) {
            m.message = m.message.documentWithCaptionMessage.message;
        }

        // Handle broadcast/status? Usually we skip those, but simple check first
        if (m.key && m.key.remoteJid === 'status@broadcast') return;

        // CRITICAL: Ignore messages from bot itself (double protection)
        if (m.key.fromMe) {
            console.log('[Handler] ⏭️ Skipping - message from bot itself (fromMe)');
            return;
        }

        // Additional check: Skip if message has Baileys metadata (bot-generated)
        // DISABLED: This blocks legit private messages
        /* if (m.message?.messageContextInfo?.deviceListMetadata || m.message?.deviceSentMessage) {
            console.log('[Handler] ⏭️ Skipping - Baileys-generated message');
            return;
        } */


        // ============================================
        //     LIST RESPONSE HANDLER (Baileys v7 ORIGINAL)
        // ============================================
        if (m.message?.listResponseMessage) {
            const rowId = m.message.listResponseMessage.singleSelectReply?.selectedRowId;

            if (!rowId?.startsWith('dl_')) return;

            try {
                const from = m.key.remoteJid;
                const [, shortId, type] = rowId.split('_');

                console.log('[List] Button clicked:', rowId);

                // Get URL from cache
                const url = global.dlCache?.get(shortId);

                if (!url) {
                    return sock.sendMessage(from, {
                        text: '❌ Link sudah kadaluarsa, kirim ulang link.'
                    });
                }

                // VIDEO DOWNLOAD
                if (type.startsWith('v')) {
                    const quality = type.replace('v', '');

                    await sock.sendMessage(from, {
                        text: `⏳ Downloading video ${quality}p...`
                    });

                    try {
                        const { downloadYTDLP } = await import('../utils/ytdlp.js');
                        const result = await downloadYTDLP(url, quality);

                        await sock.sendMessage(from, {
                            video: { url: result.filePath },
                            caption: `✅ Download selesai!\n\n📹 ${quality}p\n📦 ${result.fileSize}`,
                            mimetype: 'video/mp4'
                        });

                    } catch (err) {
                        console.error('[List] Download error:', err);
                        await sock.sendMessage(from, {
                            text: `❌ Download gagal!\n\n${err.message}`
                        });
                    }

                    return;
                }

                // AUDIO DOWNLOAD
                if (type.startsWith('a')) {
                    await sock.sendMessage(from, {
                        text: '⏳ Downloading audio 128kbps...'
                    });

                    try {
                        const { downloadYTDLPAudio } = await import('../utils/ytdlp.js');
                        const result = await downloadYTDLPAudio(url);

                        await sock.sendMessage(from, {
                            audio: { url: result.filePath },
                            caption: `✅ Download selesai!\n\n🎵 MP3\n📦 ${result.fileSize}`,
                            mimetype: 'audio/mpeg'
                        });

                    } catch (err) {
                        console.error('[List] Download error:', err);
                        await sock.sendMessage(from, {
                            text: `❌ Download gagal!\n\n${err.message}`
                        });
                    }

                    return;
                }

            } catch (err) {
                console.error('[List] Handler error:', err);
            }

            return;
        }

        const body =

            m.message.conversation ||
            m.message.imageMessage?.caption ||
            m.message.videoMessage?.caption ||
            m.message.extendedTextMessage?.text ||
            "";

        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? (m.key.participant || m.participant) : from;
        if (!sender) return;

        // Extract phone number from sender (remove @s.whatsapp.net or @c.us or @lid)
        const senderNumber = sender.split('@')[0].split(':')[0].replace(/\D/g, ''); // Remove non-digits

        // Load owners from JSON file
        const owners = loadOwners();
        const isOwner = owners.includes(senderNumber);
        let isAdmin = false;

        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(from);
                const participant = metadata.participants.find(p => p.id === sender);
                isAdmin = !!participant?.admin;
            } catch (error) {
                console.error('[Handler] Failed to check admin status:', error.message);
            }
        }

        console.log('[Handler] Message received from:', from);
        console.log('[Handler] Body:', body);
        console.log('[Handler] isGroup:', isGroup);

        const { isSelfModeEnabled } = await import('../Lib/self_manager.js');
        // If self mode is enabled (globally or for this group), only owner messages are processed
        if (isSelfModeEnabled(from) && !isOwner) {
            console.log(`[Handler] Self mode active for ${from} - ignoring non-owner message`);
            return;
        }

        // =====================================
        //    Anonymous Confess Session Router
        // =====================================
        try {
            const { findSessionByUser, updateSessionActivity, cleanJid } = await import('../Lib/confess_manager.js');
            const activeSession = findSessionByUser(sender);

            if (activeSession && body.trim()) {
                // Bypass forwarding if the message is a bot command starting with '.'
                if (!body.trim().startsWith('.')) {
                    // Compare identities by pure numeric digits to be immune to JID suffix variations (@c.us vs @s.whatsapp.net)
                    const isSender = cleanJid(sender) === cleanJid(activeSession.senderJid);
                    const targetJid = isSender 
                        ? activeSession.receiverJid 
                        : activeSession.senderJid;

                    const forwardText = `💬 *Balasan*\n\n${body.trim()}`;
                    await sock.sendMessage(targetJid, { text: forwardText });

                    // Reset/extend the 1-hour inactivity timeout
                    updateSessionActivity(sock, activeSession);
                    return; // Intercept and halt further processing
                }
            } else if (!activeSession && body.trim() && !body.trim().startsWith('.')) {
                // Check if the user is replying/quoting a confess-related message but session has expired/invalid
                const quotedContext = m.message?.extendedTextMessage?.contextInfo;
                const quotedText = quotedContext?.quotedMessage?.conversation || 
                                   quotedContext?.quotedMessage?.extendedTextMessage?.text || 
                                   "";
                
                if (quotedText.includes('PESAN BARU') || quotedText.includes('Balasan') || quotedText.includes('Sesi Confess')) {
                    await sock.sendMessage(from, { 
                        text: "❌ *Sesi Confess telah berakhir atau tidak valid.*\n\nSesi ini mungkin telah ditutup secara manual atau otomatis karena tidak ada aktivitas selama 1 jam." 
                    }, { quoted: m });
                    return; // Intercept and halt further processing
                }
            }
        } catch (err) {
            console.error('[Handler] Confess forwarding router error:', err);
        }

        // ============================================
        //    ANRES-DEV6 CLICK-TO-CHAT WELCOME TRIGGER
        // ============================================
        const welcomeTrigger = body.toLowerCase().trim();
        if (
            welcomeTrigger === 'halo saya ingin mencoba bot anres-dev6' ||
            welcomeTrigger.includes('halo saya ingin mencoba bot anres-dev6') ||
            welcomeTrigger.includes('coba bot anres-dev6') ||
            welcomeTrigger.includes('mencoba bot anres-dev6') ||
            welcomeTrigger.includes('mencoba bot anres dev6')
        ) {
            console.log('[Handler] Triggering custom welcome for ANRES-DEV6');
            
            const pushName = m.pushName || 'Kak';
            
            const toMono = (str) => {
                return str.split('').map(c => {
                    if (c >= 'a' && c <= 'z') return String.fromCodePoint(0x1D68A + (c.charCodeAt(0) - 97));
                    if (c >= 'A' && c <= 'Z') return String.fromCodePoint(0x1D670 + (c.charCodeAt(0) - 65));
                    if (c >= '0' && c <= '9') return String.fromCodePoint(0x1D7F6 + (c.charCodeAt(0) - 48));
                    return c;
                }).join('');
            };

            const greetingText = `👋 Halo Kak *${pushName}*, Selamat datang di *ANRES-DEV*! 🌟\n\n` +
                `Senang sekali Kakak berkunjung ke layanan bot WhatsApp kami. Ada yang bisa kami bantu hari ini? 😊\n\n` +
                `Berikut adalah *Menu Layanan Utama* yang dapat Kakak coba:\n\n` +
                `🏠 ${toMono('MAIN MENU')} » ${toMono('.menu main')}\n` +
                `🎨 ${toMono('STICKER CREATOR')} » ${toMono('.menu sticker')}\n` +
                `📥 ${toMono('AUTO DOWNLOADER')} » ${toMono('.menu download')}\n` +
                `🛠️ ${toMono('TOOLS / UTILITIES')} » ${toMono('.menu tools')}\n` +
                `🔮 ${toMono('PRIMBON / FUN')} » ${toMono('.menu primbon')}\n` +
                `🎮 ${toMono('FUN GAMES')} » ${toMono('.menu game')}\n` +
                `📖 ${toMono('TOBAT / AGAMA')} » ${toMono('.menu tobat')}\n` +
                `🔄 ${toMono('CONVERTER')} » ${toMono('.menu converter')}\n` +
                `👥 ${toMono('GRUP / COMMUNITY')} » ${toMono('.menu grup')}\n` +
                `ℹ️ ${toMono('INFO & STATUS')} » ${toMono('.menu info')}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `💡 *Tip Penggunaan:*\n` +
                `👉 Ketik *${toMono('.menu')}* untuk melihat daftar kategori secara interaktif.\n` +
                `👉 Ketik *${toMono('.menu all')}* untuk menampilkan seluruh daftar perintah bot.\n` +
                `👉 Ketik *${toMono('.menu [nama_kategori]')}* untuk melihat perintah detail per kategori.\n\n` +
                `Selamat mencoba dan semoga harimu menyenangkan! ✨`;

            try {
                const fs = await import('fs');
                const path = await import('path');
                const menuImagePath = path.join(process.cwd(), 'data', 'anres-menu.png');

                if (fs.default.existsSync(menuImagePath)) {
                    await sock.sendMessage(from, {
                        image: fs.default.readFileSync(menuImagePath),
                        caption: greetingText
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(from, { text: greetingText }, { quoted: m });
                }
                return; // Intercept and finish processing
            } catch (err) {
                console.error('[Handler] Custom welcome message error:', err);
            }
        }

        // =====================================
        //    Handle Button Response (YT-DLP)
        // =====================================
        if (m.message?.buttonsResponseMessage) {
            const buttonId = m.message.buttonsResponseMessage.selectedButtonId;
            console.log('[Handler] Button clicked:', buttonId);

            const { getDownloadSession, clearDownloadSession } = await import('../utils/downloadState.js');
            const session = getDownloadSession(sender);

            if (!session) {
                return sock.sendMessage(from, {
                    text: '❌ Session expired atau tidak ditemukan.\n\n💡 Silakan kirim URL lagi.'
                });
            }

            // Handle video quality selection
            if (buttonId.startsWith('ytv_')) {
                const formatId = buttonId.replace('ytv_', '');

                const progressMsg = await sock.sendMessage(from, {
                    text: '⏳ *Mendownload video...*\n\n_Mohon tunggu, proses mungkin memakan waktu..._'
                });

                try {
                    const { downloadVideo } = await import('../utils/ytdlp.js');
                    const outputPath = path.join(__dirname, '../temp', `yt_${Date.now()}.mp4`);

                    // Ensure temp directory exists
                    const tempDir = path.join(__dirname, '../temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }

                    await downloadVideo(session.url, formatId, outputPath);

                    await sock.sendMessage(from, {
                        text: '📤 *Mengirim video...*',
                        edit: progressMsg.key
                    });

                    const stats = fs.statSync(outputPath);
                    const fileSizeMB = stats.size / (1024 * 1024);

                    if (fileSizeMB > 100) {
                        fs.unlinkSync(outputPath);
                        return sock.sendMessage(from, {
                            text: '❌ File terlalu besar (>100MB)!\n\n💡 Coba pilih kualitas lebih rendah.',
                            edit: progressMsg.key
                        });
                    }

                    await sock.sendMessage(from, {
                        video: fs.readFileSync(outputPath),
                        caption: `🎬 *${session.metadata.title}*\n\n📦 Size: ${fileSizeMB.toFixed(2)}MB\n✅ Downloaded successfully`,
                        mimetype: 'video/mp4'
                    });

                    fs.unlinkSync(outputPath);

                    await sock.sendMessage(from, {
                        text: '✅ *Selesai!*',
                        edit: progressMsg.key
                    });

                } catch (error) {
                    console.error('[YT-DLP] Download error:', error);
                    await sock.sendMessage(from, {
                        text: `❌ *Gagal download!*\n\n⚠️ ${error.message}`,
                        edit: progressMsg.key
                    });
                }

                clearDownloadSession(sender);
                return;
            }

            // Handle audio quality selection
            if (buttonId.startsWith('ytmp3_') || buttonId === 'ytm4a') {
                const quality = buttonId.replace('ytmp3_', '');

                const progressMsg = await sock.sendMessage(from, {
                    text: '⏳ *Mendownload audio...*'
                });

                try {
                    const { downloadAudio } = await import('../utils/ytdlp.js');
                    const outputPath = path.join(__dirname, '../temp', `yt_${Date.now()}.mp3`);

                    const tempDir = path.join(__dirname, '../temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }

                    await downloadAudio(session.url, quality, outputPath);

                    await sock.sendMessage(from, {
                        text: '📤 *Mengirim audio...*',
                        edit: progressMsg.key
                    });

                    const stats = fs.statSync(outputPath);
                    const fileSizeMB = stats.size / (1024 * 1024);

                    await sock.sendMessage(from, {
                        audio: fs.readFileSync(outputPath),
                        mimetype: 'audio/mpeg',
                        fileName: `${session.metadata.title}.mp3`
                    });

                    fs.unlinkSync(outputPath);

                    await sock.sendMessage(from, {
                        text: '✅ *Selesai!*',
                        edit: progressMsg.key
                    });

                } catch (error) {
                    console.error('[YT-DLP] Download error:', error);
                    await sock.sendMessage(from, {
                        text: `❌ *Gagal download!*\n\n⚠️ ${error.message}`,
                        edit: progressMsg.key
                    });
                }

                clearDownloadSession(sender);
                return;
            }
        }

        // =====================================
        //  Handle Interactive Message Response
        // =====================================
        if (m.message?.interactiveResponseMessage) {
            const interactiveResponse = m.message.interactiveResponseMessage;
            const nativeFlowResponse = interactiveResponse.nativeFlowResponseMessage;

            if (nativeFlowResponse) {
                try {
                    const paramsJson = JSON.parse(nativeFlowResponse.paramsJson);
                    const selectedId = paramsJson.id;

                    console.log('[Handler] Interactive selection:', selectedId);

                    // Extract quality and URL from ID
                    // Universal format: dl_video_720_https://...
                    // or: dl_audio_128_https://...
                    // Legacy format: ytv_720_https://youtube.com/...
                    const parts = selectedId.split('_');
                    const type = parts[0]; // dl, ytv, ytmp3, etc
                    const subtype = parts[1]; // video, audio, or quality number

                    // Handle universal download format (dl_video_, dl_audio_)
                    // Handle universal download format
                    if (type === 'dl') {
                        let downloadType, quality, url;

                        // Check if using Short ID (subtype doesn't match video/audio)
                        if (subtype !== 'video' && subtype !== 'audio' && subtype !== 'auto' && global.dlCache && global.dlCache.has(subtype)) {
                            // Short ID format: dl_<shortId>_v<quality>
                            url = global.dlCache.get(subtype);
                            const action = parts[2]; // v720 or a128 or more or page_1

                            // Special Handler for Pagination
                            if (action && action.startsWith('page_')) {
                                console.log('[Handler] User requested page navigation');

                                // ✅ ENGINE VALIDATION - Only process if session exists
                                const { getSession, updateSession } = await import('../utils/sessionManager.js');
                                const session = getSession(from);

                                if (!session) {
                                    console.log('[Handler] No active session for pagination');
                                    await sock.sendMessage(from, { text: '❌ Session expired. Kirim link lagi.' });
                                    return;
                                }

                                const pageNum = parseInt(action.replace('page_', ''));
                                const { sendUniversalQualityList } = await import('../utils/interactiveMessage.js');

                                try {
                                    // Update page in session
                                    updateSession(from, { page: pageNum });

                                    await sendUniversalQualityList(
                                        sock,
                                        from,
                                        session.title,
                                        session.platform,
                                        session.qualities,
                                        session.url,
                                        pageNum
                                    );
                                } catch (err) {
                                    console.error(err);
                                    await sock.sendMessage(from, { text: '❌ Pagination failed' });
                                }
                                return;
                            }

                            // Special Handler for "More Options" (Legacy - now replaced by pagination)
                            if (action === 'more') {
                                console.log('[Handler] User requested full quality list');
                                const { sendFullList, detectAvailableQualities } = await import('../utils/interactiveMessage.js');
                                const { detectPlatform } = await import('../utils/platformDetector.js');

                                const loading = await sock.sendMessage(from, { text: '⏳ *Loading options...*' });

                                try {
                                    const platform = detectPlatform(url);
                                    let qualities = { video: [], audio: [] };
                                    try {
                                        qualities = await detectAvailableQualities(url, platform);
                                    } catch (e) {
                                        console.error('Redetect failed:', e);
                                        // Fallback
                                        qualities.video = [144, 240, 360, 480, 720, 1080];
                                    }

                                    await sendFullList(sock, from, 'Full Quality Menu', platform, qualities, url);
                                    await sock.sendMessage(from, { delete: loading.key });
                                } catch (err) {
                                    console.error(err);
                                    await sock.sendMessage(from, { text: '❌ Failed to load list', edit: loading.key });
                                }
                                return;
                            }

                            if (action.startsWith('v')) {
                                downloadType = 'video';
                                quality = action.substring(1); // 720
                            } else if (action.startsWith('a')) {
                                downloadType = 'audio';
                                quality = action.substring(1); // 128
                            } else {
                                downloadType = 'auto';
                                quality = 'best';
                            }
                            console.log(`[Handler] Resolved Short ID: ${subtype} -> ${url}`);
                        } else {
                            // Legacy Long ID format: dl_video_720_http...
                            downloadType = subtype;
                            quality = parts[2];
                            url = parts.slice(3).join('_');
                        }

                        const progressMsg = await sock.sendMessage(from, {
                            text: `⏳ *Downloading ${downloadType}...*\n\n_Mohon tunggu..._`
                        });

                        try {
                            if (downloadType === 'video') {
                                // Video download with compression
                                const { downloadVideo } = await import('../utils/ytdlp.js');
                                const { autoCompress } = await import('../utils/compression.js');
                                const outputPath = path.join(__dirname, '../temp', `dl_${Date.now()}.mp4`);

                                const tempDir = path.join(__dirname, '../temp');
                                if (!fs.existsSync(tempDir)) {
                                    fs.mkdirSync(tempDir, { recursive: true });
                                }

                                // Download
                                await downloadVideo(url, `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`, outputPath);

                                let stats = fs.statSync(outputPath);
                                let fileSizeMB = stats.size / (1024 * 1024);

                                // Auto compress if > 25MB
                                if (fileSizeMB > 25) {
                                    await sock.sendMessage(from, {
                                        text: `📦 *Compressing (${fileSizeMB.toFixed(2)}MB)...*`,
                                        edit: progressMsg.key
                                    });

                                    const compressResult = await autoCompress(outputPath, 25, 'video');
                                    if (compressResult.compressed) {
                                        fileSizeMB = compressResult.newSize;
                                    }
                                }

                                if (fileSizeMB > 100) {
                                    fs.unlinkSync(outputPath);
                                    return sock.sendMessage(from, {
                                        text: '❌ File terlalu besar (>100MB)!\n\n💡 Coba kualitas lebih rendah.',
                                        edit: progressMsg.key
                                    });
                                }

                                await sock.sendMessage(from, {
                                    video: fs.readFileSync(outputPath),
                                    caption: `✅ Downloaded\n\n📊 ${quality}p\n📦 ${fileSizeMB.toFixed(2)}MB`,
                                    mimetype: 'video/mp4'
                                });

                                fs.unlinkSync(outputPath);

                                await sock.sendMessage(from, {
                                    text: '✅ *Selesai!*',
                                    edit: progressMsg.key
                                });

                            } else if (downloadType === 'audio') {
                                // Audio download with compression
                                const { downloadAudio } = await import('../utils/ytdlp.js');
                                const { autoCompress } = await import('../utils/compression.js');
                                const outputPath = path.join(__dirname, '../temp', `dl_${Date.now()}.mp3`);

                                const tempDir = path.join(__dirname, '../temp');
                                if (!fs.existsSync(tempDir)) {
                                    fs.mkdirSync(tempDir, { recursive: true });
                                }

                                await downloadAudio(url, quality, outputPath);

                                let stats = fs.statSync(outputPath);
                                let fileSizeMB = stats.size / (1024 * 1024);

                                // Auto compress if > 25MB
                                if (fileSizeMB > 25) {
                                    await sock.sendMessage(from, {
                                        text: `📦 *Compressing (${fileSizeMB.toFixed(2)}MB)...*`,
                                        edit: progressMsg.key
                                    });

                                    const compressResult = await autoCompress(outputPath, 25, 'audio');
                                    if (compressResult.compressed) {
                                        fileSizeMB = compressResult.newSize;
                                    }
                                }

                                await sock.sendMessage(from, {
                                    audio: fs.readFileSync(outputPath),
                                    mimetype: 'audio/mpeg',
                                    fileName: 'audio.mp3'
                                });

                                fs.unlinkSync(outputPath);

                                await sock.sendMessage(from, {
                                    text: `✅ *Selesai!*\n\n📦 ${fileSizeMB.toFixed(2)}MB`,
                                    edit: progressMsg.key
                                });

                            } else if (downloadType === 'auto') {
                                // Auto best quality
                                const { downloadVideo } = await import('../utils/ytdlp.js');
                                const outputPath = path.join(__dirname, '../temp', `dl_${Date.now()}.mp4`);

                                const tempDir = path.join(__dirname, '../temp');
                                if (!fs.existsSync(tempDir)) {
                                    fs.mkdirSync(tempDir, { recursive: true });
                                }

                                await downloadVideo(url, 'best', outputPath);

                                const stats = fs.statSync(outputPath);
                                const fileSizeMB = stats.size / (1024 * 1024);

                                if (fileSizeMB > 100) {
                                    fs.unlinkSync(outputPath);
                                    return sock.sendMessage(from, {
                                        text: '❌ File terlalu besar (>100MB)!',
                                        edit: progressMsg.key
                                    });
                                }

                                await sock.sendMessage(from, {
                                    video: fs.readFileSync(outputPath),
                                    caption: `✅ Downloaded\n\n📦 ${fileSizeMB.toFixed(2)}MB`,
                                    mimetype: 'video/mp4'
                                });

                                fs.unlinkSync(outputPath);

                                await sock.sendMessage(from, {
                                    text: '✅ *Selesai!*',
                                    edit: progressMsg.key
                                });
                            }

                        } catch (err) {
                            console.error('[Universal DL] Error:', err);
                            await sock.sendMessage(from, {
                                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`,
                                edit: progressMsg.key
                            });
                        }

                        return;
                    }

                    // Legacy YouTube format handling
                    const quality = parts[1]; // 720, 128, etc
                    const url = parts.slice(2).join('_'); // reconstruct URL

                    if (type.startsWith('ytv')) {
                        // Video download
                        const progressMsg = await sock.sendMessage(from, {
                            text: `⏳ *Mendownload video ${quality}p...*\n\n_Mohon tunggu..._`
                        });

                        try {
                            const { downloadVideo } = await import('../utils/ytdlp.js');
                            const { autoCompress } = await import('../utils/compression.js');
                            const outputPath = path.join(__dirname, '../temp', `yt_${Date.now()}.mp4`);

                            const tempDir = path.join(__dirname, '../temp');
                            if (!fs.existsSync(tempDir)) {
                                fs.mkdirSync(tempDir, { recursive: true });
                            }

                            // Download with specific height
                            await downloadVideo(url, `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`, outputPath);

                            let stats = fs.statSync(outputPath);
                            let fileSizeMB = stats.size / (1024 * 1024);

                            // Auto compress if > 25MB
                            if (fileSizeMB > 25) {
                                await sock.sendMessage(from, {
                                    text: `📦 *File besar (${fileSizeMB.toFixed(2)}MB), compressing...*`,
                                    edit: progressMsg.key
                                });

                                const compressResult = await autoCompress(outputPath, 25, 'video');

                                if (compressResult.compressed) {
                                    fileSizeMB = compressResult.newSize;
                                    console.log(`[Compress] Video compressed: ${compressResult.originalSize.toFixed(2)}MB → ${compressResult.newSize.toFixed(2)}MB`);
                                }
                            }

                            if (fileSizeMB > 100) {
                                fs.unlinkSync(outputPath);
                                return sock.sendMessage(from, {
                                    text: '❌ File masih terlalu besar (>100MB) setelah compression!\n\n💡 Coba kualitas lebih rendah.',
                                    edit: progressMsg.key
                                });
                            }

                            await sock.sendMessage(from, {
                                video: fs.readFileSync(outputPath),
                                caption: `✅ *Video Downloaded*\n\n📊 Quality: ${quality}p\n📦 Size: ${fileSizeMB.toFixed(2)}MB`,
                                mimetype: 'video/mp4'
                            });

                            fs.unlinkSync(outputPath);

                            await sock.sendMessage(from, {
                                text: '✅ *Selesai!*',
                                edit: progressMsg.key
                            });

                        } catch (err) {
                            console.error('[YT] Download error:', err);
                            await sock.sendMessage(from, {
                                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`,
                                edit: progressMsg.key
                            });
                        }

                    } else if (type.startsWith('ytmp3') || type === 'ytm4a') {
                        // Audio download
                        const bitrate = type === 'ytm4a' ? 'best' : quality;
                        const progressMsg = await sock.sendMessage(from, {
                            text: `⏳ *Mendownload audio ${bitrate}kbps...*\n\n_Mohon tunggu..._`
                        });

                        try {
                            const { downloadAudio } = await import('../utils/ytdlp.js');
                            const { autoCompress } = await import('../utils/compression.js');
                            const ext = type === 'ytm4a' ? 'm4a' : 'mp3';
                            const outputPath = path.join(__dirname, '../temp', `yt_${Date.now()}.${ext}`);

                            const tempDir = path.join(__dirname, '../temp');
                            if (!fs.existsSync(tempDir)) {
                                fs.mkdirSync(tempDir, { recursive: true });
                            }

                            await downloadAudio(url, bitrate, outputPath);

                            let stats = fs.statSync(outputPath);
                            let fileSizeMB = stats.size / (1024 * 1024);

                            // Auto compress if > 25MB
                            if (fileSizeMB > 25) {
                                await sock.sendMessage(from, {
                                    text: `📦 *File besar (${fileSizeMB.toFixed(2)}MB), compressing...*`,
                                    edit: progressMsg.key
                                });

                                const compressResult = await autoCompress(outputPath, 25, 'audio');

                                if (compressResult.compressed) {
                                    fileSizeMB = compressResult.newSize;
                                    console.log(`[Compress] Audio compressed: ${compressResult.originalSize.toFixed(2)}MB → ${compressResult.newSize.toFixed(2)}MB`);
                                }
                            }

                            await sock.sendMessage(from, {
                                audio: fs.readFileSync(outputPath),
                                mimetype: ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg',
                                fileName: `audio.${ext}`
                            });

                            fs.unlinkSync(outputPath);

                            await sock.sendMessage(from, {
                                text: `✅ *Selesai!*\n\n📦 Size: ${fileSizeMB.toFixed(2)}MB`,
                                edit: progressMsg.key
                            });

                        } catch (err) {
                            console.error('[YT] Download error:', err);
                            await sock.sendMessage(from, {
                                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`,
                                edit: progressMsg.key
                            });
                        }
                    }

                    return;

                } catch (err) {
                    console.error('[Handler] Interactive response error:', err);
                }
            }
        }

        // =====================================
        //    Handle List Response (YT-DLP)
        // =====================================
        if (m.message?.listResponseMessage) {
            const listResponse = m.message.listResponseMessage;
            const selectedId = listResponse.singleSelectReply?.selectedRowId;

            if (selectedId) {
                console.log('[Handler] List item selected:', selectedId);

                const { getDownloadSession, clearDownloadSession } = await import('../utils/downloadState.js');
                const session = getDownloadSession(sender);

                if (!session) {
                    return sock.sendMessage(from, {
                        text: '❌ Session expired atau tidak ditemukan.\n\n💡 Silakan kirim URL lagi.'
                    });
                }

                // Handle video quality selection from list
                if (selectedId.startsWith('ytv_')) {
                    const formatId = selectedId.replace('ytv_', '');

                    const progressMsg = await sock.sendMessage(from, {
                        text: '⏳ *Mendownload video...*\n\n_Mohon tunggu, proses mungkin memakan waktu..._'
                    });

                    try {
                        const { downloadVideo } = await import('../utils/ytdlp.js');
                        const outputPath = path.join(__dirname, '../temp', `yt_${Date.now()}.mp4`);

                        const tempDir = path.join(__dirname, '../temp');
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true });
                        }

                        await downloadVideo(session.url, formatId, outputPath);

                        await sock.sendMessage(from, {
                            text: '📤 *Mengirim video...*',
                            edit: progressMsg.key
                        });

                        const stats = fs.statSync(outputPath);
                        const fileSizeMB = stats.size / (1024 * 1024);

                        if (fileSizeMB > 100) {
                            fs.unlinkSync(outputPath);
                            return sock.sendMessage(from, {
                                text: '❌ File terlalu besar (>100MB)!\n\n💡 Coba pilih kualitas lebih rendah.',
                                edit: progressMsg.key
                            });
                        }

                        await sock.sendMessage(from, {
                            video: fs.readFileSync(outputPath),
                            caption: `🎬 *${session.metadata.title}*\n\n📦 Size: ${fileSizeMB.toFixed(2)}MB\n✅ Downloaded successfully`,
                            mimetype: 'video/mp4'
                        });

                        fs.unlinkSync(outputPath);

                        await sock.sendMessage(from, {
                            text: '✅ *Selesai!*',
                            edit: progressMsg.key
                        });

                    } catch (error) {
                        console.error('[YT-DLP] Download error:', error);
                        await sock.sendMessage(from, {
                            text: `❌ *Gagal download!*\n\n⚠️ ${error.message}`,
                            edit: progressMsg.key
                        });
                    }

                    clearDownloadSession(sender);
                    return;
                }

                // Handle audio format selection from list
                if (selectedId.startsWith('ytmp3_') || selectedId.startsWith('yt')) {
                    let quality = '192';
                    let format = 'mp3';

                    if (selectedId.startsWith('ytmp3_')) {
                        quality = selectedId.replace('ytmp3_', '');
                    } else if (selectedId === 'ytm4a') {
                        format = 'm4a';
                    } else if (selectedId === 'ytopus') {
                        format = 'opus';
                    } else if (selectedId === 'ytogg') {
                        format = 'ogg';
                    }

                    const progressMsg = await sock.sendMessage(from, {
                        text: '⏳ *Mendownload audio...*'
                    });

                    try {
                        const { exec } = await import('child_process');
                        const { promisify } = await import('util');
                        const execAsync = promisify(exec);

                        const outputPath = path.join(__dirname, '../temp', `yt_${Date.now()}.${format}`);
                        const tempDir = path.join(__dirname, '../temp');
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true });
                        }

                        let cmd;
                        if (format === 'm4a') {
                            cmd = `yt-dlp -f "bestaudio[ext=m4a]/bestaudio" -o "${outputPath}" "${session.url}"`;
                        } else {
                            cmd = `yt-dlp -x --audio-format ${format} --audio-quality ${quality}K -o "${outputPath}" "${session.url}"`;
                        }

                        await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 });

                        await sock.sendMessage(from, {
                            text: '📤 *Mengirim audio...*',
                            edit: progressMsg.key
                        });

                        const stats = fs.statSync(outputPath);
                        const fileSizeMB = stats.size / (1024 * 1024);

                        await sock.sendMessage(from, {
                            audio: fs.readFileSync(outputPath),
                            mimetype: format === 'm4a' ? 'audio/mp4' : 'audio/mpeg',
                            fileName: `${session.metadata.title}.${format}`
                        });

                        fs.unlinkSync(outputPath);

                        await sock.sendMessage(from, {
                            text: '✅ *Selesai!*',
                            edit: progressMsg.key
                        });

                    } catch (error) {
                        console.error('[YT-DLP] Download error:', error);
                        await sock.sendMessage(from, {
                            text: `❌ *Gagal download!*\n\n⚠️ ${error.message}`,
                            edit: progressMsg.key
                        });
                    }

                    clearDownloadSession(sender);
                    return;
                }
            }
        }

        if (m.message?.stickerMessage && isGroup) {
            try {
                const autobans = await getAutobans();
                const wasBlocked = await autobans.default.checkSticker(sock, m);
                if (wasBlocked) return;
            } catch (error) {
                console.error('[Handler] Auto-ban error:', error);
            }
        }

        if (lastRiddle.has(from) && !body.startsWith(".")) {
            const saved = lastRiddle.get(from);
            const answer = saved.a;
            const user = body.toLowerCase();

            if (user === "nyerah" || user === "nyerah nyerah") {
                clearTimeout(saved.timeout);

                await sock.sendMessage(from, {
                    text: `Kok Nyerah se \nJawabannya: *${answer}*`
                });

                lastRiddle.delete(from);
                return;
            }

            // Cek jawaban bener
            if (user.includes(answer)) {
                clearTimeout(saved.timeout);

                await sock.sendMessage(from, {
                    text: `kok iso jawab *${answer}*`
                });

                lastRiddle.delete(from);
                return;
            }

            // Jawaban salah → biarkan
        }


        // =====================================
        //        Cek Jawaban CAK LONTONG
        // =====================================

        if (global.cakLontong && global.cakLontong[from]) {
            const jawaban = global.cakLontong[from];

            if (body.toLowerCase() === "nyerah") {
                delete global.cakLontong[from];
                return sock.sendMessage(from, { text: `nyerah ya ini, jawabannya: *${jawaban}*` });
            }

            if (body.toLowerCase().includes(jawaban)) {
                delete global.cakLontong[from];
                return sock.sendMessage(from, { text: `Asoyy Gokil Banget, Jawabannya emang: *${jawaban}*` });
            }
        }

        // =====================================
        //        Cek Jawaban CERDAS CERMAT
        // =====================================
        if (global.cerdasGame && global.cerdasGame[from] && !body.startsWith(".")) {
            // Skip if message is from bot itself
            if (m.key.fromMe) return;

            try {
                const cerdasModule = await import('../commands/ai/cerdas.js');
                const wasHandled = await cerdasModule.default.checkAnswer(sock, m, body);
                if (wasHandled) return;
            } catch (error) {
                console.error('[Handler] Cerdas game error:', error);
            }
        }

        // =====================================
        //        Cek Jawaban FAMILY 100
        // =====================================
        if (global.family100 && global.family100[from]) {
            const room = global.family100[from];
            const textLower = body.toLowerCase();

            // Nyerah
            if (textLower === "nyerah" || textLower === "nyerah nyerah") {
                clearTimeout(room.timeout);
                if (room.countdownInterval) clearInterval(room.countdownInterval);

                const unAnswered = room.jawaban.filter((_, i) => !room.terjawab.includes(i));

                await sock.sendMessage(from, {
                    text: `*Kamu Menyerah!*\n\nJawaban yang belum terjawab:\n${unAnswered.map((j, i) => `${i + 1}. ${j}`).join('\n')}\n\nGame berakhir.`
                });

                delete global.family100[from];
                return;
            }

            // Clue
            if (textLower === "clue" || textLower === "hint") {
                if (room.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    }, { quoted: m });
                    return;
                }

                // Give 3 random unanswered answers as clue
                const unanswered = room.jawaban.filter((j, i) => !room.terjawab.includes(i));
                const clueCount = Math.min(3, unanswered.length);
                const clues = [];

                for (let i = 0; i < clueCount; i++) {
                    const randomIndex = Math.floor(Math.random() * unanswered.length);
                    const clue = unanswered[randomIndex];
                    clues.push(clue);
                    unanswered.splice(randomIndex, 1);
                }

                room.clueUsed = true;

                const clueMsg = `💡 *CLUE*\n\nBeberapa jawaban yang mungkin:\n${clues.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n_Clue hanya bisa digunakan 1x!_`;
                await sock.sendMessage(from, { text: clueMsg }, { quoted: m });
                return;
            }

            // Cek Jawaban
            const index = room.jawaban.findIndex(ans => ans === textLower);

            if (index >= 0) {
                if (room.terjawab.includes(index)) {
                    // Sudah terjawab, ignore
                    return;
                }

                room.terjawab.push(index);

                const isWin = room.terjawab.length === room.jawaban.length;

                // Update main message with new board
                try {
                    // Get current time left (estimate based on elapsed time)
                    const elapsed = Date.now() - (room.startTime || Date.now());
                    const timeLeft = Math.max(0, 120 - Math.floor(elapsed / 1000));

                    await sock.sendMessage(from, {
                        text: room.buildMessage(timeLeft, room.terjawab),
                        edit: room.messageKey
                    });
                } catch (error) {
                    console.error('[Family100] Edit error:', error);
                }

                if (isWin) {
                    clearTimeout(room.timeout);
                    if (room.countdownInterval) clearInterval(room.countdownInterval);

                    await sock.sendMessage(from, {
                        text: `🎉 *SELAMAT!*\n\nKamu berhasil menjawab semua soal!\n\n✨ Permainan Selesai!`
                    });

                    delete global.family100[from];
                }

                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK KATA
        // =====================================
        if (global.tebakKata && global.tebakKata[from] && !body.startsWith(".")) {
            const game = global.tebakKata[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakKata[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakKata[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK HEWAN
        // =====================================
        if (global.tebakHewan && global.tebakHewan[from] && !body.startsWith(".")) {
            const game = global.tebakHewan[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakHewan[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakHewan[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban SIAPA AKU
        // =====================================
        if (global.siapakahaku && global.siapakahaku[from] && !body.startsWith(".")) {
            const game = global.siapakahaku[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.siapakahaku[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.siapakahaku[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban LENGKAPI KALIMAT
        // =====================================
        if (global.lengkapiKalimat && global.lengkapiKalimat[from] && !body.startsWith(".")) {
            const game = global.lengkapiKalimat[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.lengkapiKalimat[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.lengkapiKalimat[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK GAMBAR
        // =====================================
        if (global.tebakGambar && global.tebakGambar[from] && !body.startsWith(".")) {
            const game = global.tebakGambar[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakGambar[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakGambar[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK-TEBAKAN
        // =====================================
        if (global.tebakTebakan && global.tebakTebakan[from] && !body.startsWith(".")) {
            const game = global.tebakTebakan[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakTebakan[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                if (game.countdownInterval) clearInterval(game.countdownInterval);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakTebakan[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK BENDA
        // =====================================
        if (global.tebakBenda && global.tebakBenda[from] && !body.startsWith(".")) {
            const game = global.tebakBenda[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakBenda[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakBenda[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK HEWAN
        // =====================================
        if (global.tebakHewan && global.tebakHewan[from] && !body.startsWith(".")) {
            const game = global.tebakHewan[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakHewan[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakHewan[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK ADAT
        // =====================================
        if (global.tebakAdat && global.tebakAdat[from] && !body.startsWith(".")) {
            const game = global.tebakAdat[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakAdat[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakAdat[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK NEGARA
        // =====================================
        if (global.tebakNegara && global.tebakNegara[from] && !body.startsWith(".")) {
            const game = global.tebakNegara[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakNegara[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakNegara[from];
                return;
            }
        }

        // =====================================
        //        Cek Jawaban TEBAK IBUKOTA
        // =====================================
        if (global.tebakIbukota && global.tebakIbukota[from] && !body.startsWith(".")) {
            const game = global.tebakIbukota[from];
            const userAnswer = body.toLowerCase().trim();

            if (userAnswer === "nyerah") {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `😔 Nyerah ya?\n\n✅ Jawaban yang benar: *${game.jawaban}*`
                });
                delete global.tebakIbukota[from];
                return;
            }

            if (userAnswer === "clue" || userAnswer === "hint") {
                if (game.clueUsed) {
                    await sock.sendMessage(from, {
                        text: '❌ Clue sudah digunakan!'
                    });
                    return;
                }
                game.clueUsed = true;
                await sock.sendMessage(from, {
                    text: `💡 *PETUNJUK*\n\n${game.clue}`
                });
                return;
            }

            if (userAnswer === game.jawaban) {
                clearTimeout(game.timeout);
                await sock.sendMessage(from, {
                    text: `🎉 *BENAR!*\n\nJawaban: *${game.jawaban}*\n\nKeren banget! 🔥`
                });
                delete global.tebakIbukota[from];
                return;
            }
        }

        // ============================================
        //         CONFIRMATION HANDLER
        // ============================================
        // Check for pending confirmations (yes/no responses)
        if (!body.startsWith(".") && (body.toLowerCase() === "yes" || body.toLowerCase() === "no")) {
            try {
                const { confirmationManager } = await import('../utils/security.js');
                const confirmation = confirmationManager.get(sender);

                if (confirmation) {
                    if (body.toLowerCase() === "yes") {
                        // Execute confirmed action
                        if (confirmation.action === 'file_delete') {
                            const fs = await import('fs');
                            fs.default.unlinkSync(confirmation.data.path);

                            const { logActivity } = await import('../utils/security.js');
                            logActivity(sender, `file delete ${confirmation.data.displayPath}`, 'Success (Confirmed)');

                            confirmationManager.confirm(sender);

                            await sock.sendMessage(from, {
                                text: `✅ File deleted: ${confirmation.data.displayPath}`
                            });
                        }
                    } else {
                        // Cancel action
                        confirmationManager.cancel(sender);
                        await sock.sendMessage(from, {
                            text: "❌ Action cancelled"
                        });
                    }
                    return;
                }
            } catch (error) {
                console.error('[Confirmation] Error:', error);
            }
        }

        // ============================================
        //         AUTO AI RESPONSE
        // ============================================
        if (!body.startsWith(".") && body.trim().length > 0 && !m.key.fromMe) {
            // Check if auto AI is enabled for this chat
            if (global.aiAutoResponse && global.aiAutoResponse[from]) {
                // Skip if there's an active game
                const hasActiveGame = lastRiddle.has(from) ||
                    (global.cakLontong && global.cakLontong[from]) ||
                    (global.family100 && global.family100[from]) ||
                    (global.cerdasGame && global.cerdasGame[from]) ||
                    (global.tebakKata && global.tebakKata[from]) ||
                    (global.tebakBenda && global.tebakBenda[from]) ||
                    (global.tebakHewan && global.tebakHewan[from]) ||
                    (global.tebakAdat && global.tebakAdat[from]) ||
                    (global.tebakNegara && global.tebakNegara[from]) ||
                    (global.tebakIbukota && global.tebakIbukota[from]);

                if (!hasActiveGame) {
                    try {
                        // Call GPT-3 API with Gen Z style
                        const prompt = "Jawab dengan singkat, santai, pake bahasa Gen Z, pake 'lu' dan 'gw'. Jangan formal, jangan panjang-panjang.";
                        const apiUrl = `https://api.siputzx.my.id/api/ai/gpt3?prompt=${encodeURIComponent(prompt)}&content=${encodeURIComponent(body)}`;

                        const response = await fetch(apiUrl, {
                            signal: AbortSignal.timeout(30000)
                        });

                        if (response.ok) {
                            const data = await response.json();
                            const aiResponse = data.data || data.result || data.response || "Maaf, AI tidak bisa menjawab saat ini.";

                            await sock.sendMessage(from, { text: aiResponse }, { quoted: m });
                        }
                    } catch (error) {
                        console.error('Auto AI Error:', error);
                    }
                    // Don't return here - let AutoDL run too if enabled
                }
            }
        }

        // ============================================
        //              AUTO STICKER HOOK
        // ============================================
        try {
            const { isAutoStickerEnabled } = await import('../Lib/autosticker_manager.js');
            if (!body.startsWith(".") && isAutoStickerEnabled(from) && m.message?.imageMessage && !m.key.fromMe) {
                console.log('[AutoSticker] Auto sticker triggered for chat:', from);
                const content = m.message.imageMessage;

                // Send processing reaction
                await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });

                // Download image content
                const { downloadContentFromMessage } = await import('baileys');
                const stream = await downloadContentFromMessage(content, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                const { imageToWebp } = await import('../Lib/converter.js');
                const { addStickerMetadata } = await import('../Lib/sticker.js');

                // Convert to WebP high quality
                const stickerBuff = await imageToWebp(buffer);

                // Inject custom EXIF metadata
                const finalSticker = await addStickerMetadata(stickerBuff, 'ANRES-DEV6', 'Made With ANRES');

                // Send sticker
                await sock.sendMessage(from, { sticker: finalSticker }, { quoted: m });
                await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
                return; // Stop further processing
            }
        } catch (err) {
            console.error('[AutoSticker] Hook Error:', err);
        }



        // ============================================
        //         AUTO DOWNLOAD V3 (Universal Engine)
        // ============================================
        if (!body.startsWith(".") && body.trim().length > 0) {
            const { isAutoDLV3Enabled } = await import('../Lib/autodlv3_manager.js');
            const isV3 = isAutoDLV3Enabled(from);
            console.log(`[AutoDL V3] Checking status for ${from}: ${isV3}`);

            if (isV3) {
                try {
                    console.log('[AutoDL V3] Importing handler...');
                    const { handler } = await import('../autodlv3/index.js');
                    console.log('[AutoDL V3] Calling handler...');
                    const handled = await handler(m, { sock });
                    if (handled) return;
                } catch (e) {
                    console.error('[AutoDL V3] Handler Error:', e);
                }
            }
        }


        // ============================================
        //         AUTO DOWNLOAD V2 (ab-downloader)
        // ============================================
        if (!body.startsWith(".") && body.trim().length > 0) {
            const { isAutoDLV2Enabled } = await import('../Lib/autodlv2_manager.js');

            if (isAutoDLV2Enabled(from)) {
                const { extractURLs } = await import('../utils/platformDetector.js');
                const urls = extractURLs(body);

                if (urls.length > 0) {
                    const urlInfo = urls[0];
                    const supportedPlatforms = ['youtube', 'instagram', 'tiktok', 'facebook', 'twitter'];

                    if (supportedPlatforms.includes(urlInfo.platform)) {
                        console.log(`[AutoDL V2] Detected ${urlInfo.platformName} URL:`, urlInfo.url);

                        if (urlInfo.platform === 'youtube') {
                            // ─────────── YOUTUBE V2: Direct yt-dlp ───────────
                            let progressMsg;
                            try {
                                progressMsg = await sock.sendMessage(from, {
                                    text: `⏳ *AutoDL V2 - Downloading YouTube...*`
                                });

                                const { exec } = await import('child_process');
                                const { promisify } = await import('util');
                                const fs = await import('fs');
                                const path = await import('path');
                                const execAsync = promisify(exec);

                                // Import yt-dlp binary path helper
                                const { getYtdlpPath, getYtdlpBaseArgs } = await import('../utils/ytdlpBinary.js');
                                const ytdlpBin = getYtdlpPath().replace(/\\/g, '/');

                                // Buat output dir
                                const downloadDir = path.join(process.cwd(), 'download');
                                if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

                                const timestamp = Date.now();
                                const outputTemplate = path.join(downloadDir, `yt2_${timestamp}.%(ext)s`).replace(/\\/g, '/');
                                const format = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]/best';

                                const cmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} -f "${format}" --merge-output-format mp4 --no-playlist -o "${outputTemplate}" "${urlInfo.url}"`;
                                console.log('[AutoDL V2 - YouTube] Executing:', cmd);

                                await execAsync(cmd, { maxBuffer: 100 * 1024 * 1024, timeout: 120000 });

                                // Cari file hasil download berdasarkan prefix timestamp
                                const files = fs.readdirSync(downloadDir)
                                    .filter(f => f.startsWith(`yt2_${timestamp}`))
                                    .map(f => path.join(downloadDir, f));

                                if (!files.length) throw new Error('File hasil download tidak ditemukan setelah yt-dlp selesai.');

                                const filePath = files[0];
                                const stats = fs.statSync(filePath);
                                const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                                await sock.sendMessage(from, {
                                    text: '📤 *Mengirim video...*',
                                    edit: progressMsg.key
                                });

                                const caption = `📺 *YouTube Downloader V2*\n\n✅ Download selesai!\n📦 Ukuran: ${sizeMB}MB`;

                                await sock.sendMessage(from, {
                                    video: fs.readFileSync(filePath),
                                    caption: caption,
                                    mimetype: 'video/mp4'
                                });

                                // Cleanup
                                try { fs.unlinkSync(filePath); } catch {}

                                await sock.sendMessage(from, {
                                    text: '✅ *Selesai!*',
                                    edit: progressMsg.key
                                });

                                return;

                            } catch (err) {
                                console.error('[AutoDL V2] YouTube Error:', err.message);
                                const errText = `❌ *AutoDL V2 YouTube Gagal!*\n\n⚠️ ${err.message}\n\n💡 Coba manual: *.yt <link>*`;
                                if (progressMsg?.key) {
                                    await sock.sendMessage(from, { text: errText, edit: progressMsg.key });
                                } else {
                                    await sock.sendMessage(from, { text: errText });
                                }
                            }


                        } else {
                            // OTHER PLATFORMS: Direct Download (No Resolution Selection)
                            let progressMsg;
                            try {
                                progressMsg = await sock.sendMessage(from, {
                                    text: `⏳ *Downloading ${urlInfo.platformName}...*`
                                });

                                const { downloadMedia } = await import('../utils/abDownloader.js');
                                const fs = await import('fs');

                                // Direct download (now supports TikTok too)
                                const result = await downloadMedia(urlInfo.url);

                                await sock.sendMessage(from, {
                                    text: '📤 *Mengirim media...*',
                                    edit: progressMsg.key
                                });

                                const meta = result.metadata || {};
                                const caption = `🎬 *${urlInfo.platformName} Downloader V2*

📝 *Caption:* ${meta.caption || '-'}
👤 *Author:* ${meta.author || '-'}
🌍 *Region:* ${meta.country || '-'}

👍 *Likes:* ${meta.likes || '-'}
💬 *Comments:* ${meta.comments || '-'}
↪️ *Shares:* ${meta.shares || '-'}

📦 Size: ${result.size}MB
✅ Downloaded successfully`;

                                if (result.isSlide) {
                                    // SLIDE / ALBUM HANDLING
                                    await sock.sendMessage(from, {
                                        text: `✅ Slide/Album terdeteksi (${result.files.length} slide). Mengirim ke Private Chat...`,
                                        edit: progressMsg.key
                                    });

                                    // Send to Private Chat (sender)
                                    for (let i = 0; i < result.files.length; i++) {
                                        const filePath = result.files[i];
                                        const isLast = i === result.files.length - 1;

                                        // Send image
                                        await sock.sendMessage(sender, {
                                            image: fs.readFileSync(filePath),
                                            caption: isLast ? caption : `Slide ${i + 1}/${result.files.length}`
                                        });

                                        // Cleanup
                                        fs.unlinkSync(filePath);
                                        await new Promise(r => setTimeout(r, 1000)); // Delay to prevent spam/ban
                                    }

                                } else {
                                    // SINGLE FILE HANDLING
                                    if (result.filePath.endsWith('.mp4') || result.filePath.endsWith('.mkv') || result.filePath.endsWith('.webm')) {
                                        await sock.sendMessage(from, {
                                            video: fs.readFileSync(result.filePath),
                                            caption: caption,
                                            mimetype: 'video/mp4'
                                        });
                                    } else {
                                        await sock.sendMessage(from, {
                                            image: fs.readFileSync(result.filePath),
                                            caption: caption
                                        });
                                    }
                                    fs.unlinkSync(result.filePath);

                                    await sock.sendMessage(from, {
                                        text: '✅ *Selesai!*',
                                        edit: progressMsg.key
                                    });
                                }

                                return;

                            } catch (err) {
                                console.error(`[AutoDL V2] ${urlInfo.platformName} Error:`, err);
                                if (progressMsg?.key) {
                                    await sock.sendMessage(from, {
                                        text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`,
                                        edit: progressMsg.key
                                    });
                                } else {
                                    await sock.sendMessage(from, { text: `❌ *Gagal download!*\n\n⚠️ ${err.message}` });
                                }
                            }
                        }
                    }
                }
            }
        }

        // ============================================
        //         AUTO DOWNLOAD (AutoDL - yt-dlp)
        // ============================================
        if (!body.startsWith(".") && body.trim().length > 0) {
            const { isAutoDLEnabled } = await import('../Lib/autodl_manager.js');

            if (isAutoDLEnabled(from)) {
                const { extractURLs } = await import('../utils/platformDetector.js');
                const urls = extractURLs(body);

                if (urls.length > 0) {
                    const urlInfo = urls[0];

                    if (urlInfo.platform !== 'unknown') {
                        console.log(`[AutoDL] Detected ${urlInfo.platformName} URL:`, urlInfo.url);

                        // DISABLED INTERACTIVE MODE (Reverted to Direct Download)
                        // console.log(`[AutoDL] Detected ${urlInfo.platformName} URL:`, urlInfo.url);

                        // DIRECT DOWNLOAD FOR ALL PLATFORMS (Including YouTube)
                        let progressMsg;
                        try {
                            progressMsg = await sock.sendMessage(from, {
                                text: `⏳ *Downloading ${urlInfo.platformName}...*`
                            });

                            const { downloadMedia } = await import('../Lib/downloader.js');
                            const fs = await import('fs');

                            const result = await downloadMedia(urlInfo.url);

                            await sock.sendMessage(from, {
                                text: '📤 *Mengirim media...*',
                                edit: progressMsg.key
                            });

                            const caption = `🎬 *${urlInfo.platformName} Downloader (V1)*\n\n✅ Downloaded successfully\n📦 ${result.size}MB`;

                            if (result.filePath.endsWith('.mp4') || result.filePath.endsWith('.mkv') || result.filePath.endsWith('.webm')) {
                                await sock.sendMessage(from, {
                                    video: fs.readFileSync(result.filePath),
                                    caption: caption,
                                    mimetype: 'video/mp4'
                                });
                            } else {
                                await sock.sendMessage(from, {
                                    image: fs.readFileSync(result.filePath),
                                    caption: caption
                                });
                            }

                            fs.unlinkSync(result.filePath);

                            await sock.sendMessage(from, {
                                text: '✅ *Selesai!*',
                                edit: progressMsg.key
                            });

                        } catch (err) {
                            console.error(`[AutoDL] ${urlInfo.platformName} Error:`, err);
                            if (progressMsg?.key) {
                                await sock.sendMessage(from, {
                                    text: `❌ *Gagal download!*\n\n⚠️ ${err.message}\n\n💡 Coba manual: \`.dl ${urlInfo.url}\``,
                                    edit: progressMsg.key
                                });
                            } else {
                                await sock.sendMessage(from, { text: `❌ *Gagal download!*\n\n⚠️ ${err.message}` });
                            }
                        }

                        return;
                    }
                }
            }
        }

        // ============================================
        //        HANDLE COMMAND
        // ============================================
        if (!body.startsWith(".")) return;

        const cmdName = body.slice(1).trim().split(" ")[0].toLowerCase();
        const args = body.trim().split(" ").slice(1);
        const text = args.join(" ");

        const command = getCommand(cmdName);

        if (!command) return;

        // --- Permissions Check ---

        // 1. Owner Access
        if (command.access?.owner && !isOwner) {
            return sock.sendMessage(from, { text: 'Perintah ini hanya untuk owner.' }, { quoted: m });
        }

        // 2. Group Access
        if (command.access?.group && !isGroup) {
            return sock.sendMessage(from, { text: 'Perintah ini hanya bisa digunakan di grup.' }, { quoted: m });
        }

        // 3. Private Access
        if (command.access?.private && isGroup) {
            return sock.sendMessage(from, { text: 'Perintah ini hanya bisa digunakan di private chat.' }, { quoted: m });
        }

        // --- Run Command ---
        try {
            await command.run(sock, m, args, {
                text,
                isOwner,
                isGroup,
                isAdmin,
                sender,
                from,
                command: cmdName
            });
        } catch (cmdErr) {
            console.error(`[Command] Error running '${cmdName}':`, cmdErr);
            // Send minimal error info to chat for debugging (owner only)
            try {
                const owners = loadOwners();
                const senderNum = sender.split('@')[0].replace(/\D/g, '');
                if (owners.includes(senderNum)) {
                    await sock.sendMessage(from, { text: `⚠️ Error on command '${cmdName}': ${cmdErr.message}` }, { quoted: m });
                }
            } catch (e) {
                console.error('[Command] Failed to report error to owner:', e);
            }
        }

    } catch (err) {
        console.log("Handler Error:", err);
    }
}
