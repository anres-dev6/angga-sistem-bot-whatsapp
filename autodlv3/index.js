import { universalEngine } from './engine/index.js';
import { downloadWithProgress } from './engine/progress.js';
import { sendVideo, sendDocument } from './sender/index.js';

// The Main Handler Logic
export async function handler(m, { sock }) {
    // Safely extract message details
    const from = m.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? (m.key.participant || m.participant) : from;
    const text = m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption || "";

    // Extract URL from message text
    const url = text.match(/https?:\/\/\S+/)?.[0];
    if (!url) return false;

    // Check support first
    const { detectPlatform } = await import('./engine/detect.js');
    if (!detectPlatform(url)) return false; // Pass back to V1/V2 if not supported by V3

    console.log('[AutoDL V3] Processing URL:', url);

    let msg;
    try {
        msg = await sock.sendMessage(from, { text: '⏳ *AutoDL V3 Engine Started...*' }, { quoted: m });

        const result = await universalEngine(url, { m });

        if (!result) return false; // Should not happen if detectPlatform passed, unless resolver failed

        // 🖼️ TikTok slide → PRIVATE
        if (result.type === 'image-slide') {
            await sock.sendMessage(from, {
                text: `✅ ${result.images.length} Slide terdeteksi. Mengirim ke Private Chat...`,
                edit: msg.key
            });

            // Send to private
            for (let i = 0; i < result.images.length; i++) {
                const img = result.images[i];

                // Check if img is a Buffer or URL
                const imagePayload = Buffer.isBuffer(img) ? img : { url: img };

                await sock.sendMessage(sender, {
                    image: imagePayload,
                    caption: `Slide ${i + 1}/${result.images.length}`
                });
            }
            return true;
        }

        // 🎥 Video
        if (result.type === 'video') {
            let buffer;

            // Check if buffer already provided (e.g., from Instagram resolver using yt-dlp)
            if (result.buffer) {
                // Buffer already downloaded (Instagram case)
                buffer = result.buffer;
                await sock.sendMessage(from, {
                    text: '📤 Mengirim media...',
                    edit: msg.key
                });
            } else if (result.url) {
                // Download from URL with progress (TikTok case)
                let lastUpdate = 0;
                buffer = await downloadWithProgress(result.url, async (p) => {
                    // Only update every 20% or at 100%, and throttle to max 1 update per second
                    const now = Date.now();
                    if ((p % 20 === 0 || p === 100) && (now - lastUpdate > 1000 || p === 100)) {
                        lastUpdate = now;
                        try {
                            await sock.sendMessage(from, {
                                text: `📊 AutoDL V3 Progress: ${p}%`,
                                edit: msg.key
                            });
                        } catch (err) {
                            // Silently ignore edit errors (message might be deleted)
                        }
                    }
                });
            } else {
                throw new Error('No buffer or URL provided by resolver');
            }

            // Auto kirim
            // 15MB limit check (approx) -> Send as Document
            if (buffer.length > 15_000_000) {
                await sendDocument(sock, from, buffer, result.filename);
            } else {
                await sendVideo(sock, from, buffer, '✅ Done (AutoDL V3)');
            }

            await sock.sendMessage(from, { text: '✅ Selesai!', edit: msg.key });
        }
        return true;

    } catch (e) {
        console.error('[AutoDL V3] Error:', e);
        if (msg) {
            await sock.sendMessage(from, {
                text: `⚠️ AutoDL V3 gagal, mencoba engine cadangan...\n\n${e.message}`,
                edit: msg.key
            });
        }
        return false;
    }

    return false;
}
