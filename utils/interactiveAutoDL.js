import { generateWAMessageFromContent } from 'baileys';
import fs from 'fs';
import path from 'path';
import { detectPlatform } from './platformDetector.js';
import { downloadVideo, downloadAudio } from './ytdlp.js';
import { autoCompress } from './compression.js';

// Menggunakan Map global sebagai penyimpanan sementara URL asli agar ID tombol tetap pendek
if (!global.interactiveDlCache) {
    global.interactiveDlCache = new Map();
}

/**
 * Membuat ID pendek acak dan unik untuk menyimpan URL asli di Map
 * @param {string} url - URL asli yang akan diunduh
 * @returns {string} ID pendek unik
 */
function getShortId(url) {
    const id = Math.random().toString(36).substring(2, 8);
    global.interactiveDlCache.set(id, url);
    // Hapus otomatis dari memori setelah 1 jam untuk efisiensi
    setTimeout(() => {
        global.interactiveDlCache.delete(id);
    }, 3600000);
    return id;
}

/**
 * Mendeteksi platform link dan mengirimkan tombol interaktif (versi 2) ke user
 * @param {object} sock - Socket instance Baileys
 * @param {string} jid - JID penerima pesan
 * @param {string} url - URL yang dideteksi
 * @param {string} platform - Nama platform (youtube, tiktok, instagram, facebook)
 */
export async function sendInteractiveButtons(sock, jid, url, platform) {
    const shortId = getShortId(url);
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    
    let buttons = [];
    let text = "";

    // 1. Jika platform TikTok, Instagram, atau Facebook
    if (['tiktok', 'instagram', 'facebook'].includes(platform)) {
        text = `📸 *${platformName} Downloader*\n\nTerdeteksi tautan *${platformName}*.\nSilakan tekan tombol di bawah ini untuk mendownload MP3 saja.`;
        buttons = [
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🎵 Download MP3 saja",
                    id: `iadl_${shortId}_audio_128`
                })
            }
        ];
    } 
    // 2. Jika platform YouTube
    else if (platform === 'youtube') {
        text = `▶️ *YouTube Downloader*\n\nTerdeteksi tautan *YouTube*.\nSilakan pilih opsi kualitas download di bawah ini:`;
        buttons = [
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🎥 Video 360p",
                    id: `iadl_${shortId}_video_360`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🎥 Video 480p",
                    id: `iadl_${shortId}_video_480`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🎥 Video 720p",
                    id: `iadl_${shortId}_video_720`
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "🎵 Audio MP3",
                    id: `iadl_${shortId}_audio_128`
                })
            }
        ];
    }

    // Membentuk struktur pesan interaktif versi ke 2 (nativeFlowMessage di dalam viewOnceMessage)
    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: {
                        text: text
                    },
                    footer: {
                        text: "Interactive Auto Downloader"
                    },
                    nativeFlowMessage: {
                        buttons: buttons
                    }
                }
            }
        }
    }, {});

    // Kirim pesan interaktif menggunakan relayMessage
    await sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id
    });
    console.log(`[Interactive AutoDL] Tombol dikirim untuk platform: ${platform}, ShortID: ${shortId}`);
}

/**
 * Menangani respon klik tombol interaktif dari event messages.upsert
 * @param {object} sock - Socket instance Baileys
 * @param {object} m - Objek pesan dari Baileys
 * @returns {Promise<boolean>} True jika event ditangani, false jika tidak
 */
export async function handleInteractiveResponse(sock, m) {
    const from = m.key.remoteJid;
    
    // Cek apakah pesan bertipe interactiveResponseMessage (tombol diklik)
    if (!m.message?.interactiveResponseMessage) return false;

    const interactiveResponse = m.message.interactiveResponseMessage;
    const nativeFlowResponse = interactiveResponse.nativeFlowResponseMessage;

    // Pastikan paramsJson berisi ID tombol yang diklik
    if (!nativeFlowResponse?.paramsJson) return false;

    try {
        const params = JSON.parse(nativeFlowResponse.paramsJson);
        const selectedId = params.id; // Format ID: iadl_<shortId>_<type>_<quality>

        // Memvalidasi prefix ID tombol milik modul kita
        if (!selectedId || !selectedId.startsWith('iadl_')) return false;

        console.log('[Interactive AutoDL] Tombol ditekan dengan ID:', selectedId);

        const parts = selectedId.split('_');
        const shortId = parts[1];
        const downloadType = parts[2]; // 'video' atau 'audio'
        const quality = parts[3];      // '360', '480', '720', atau '128'

        // Mengambil URL asli dari penyimpanan Map
        const url = global.interactiveDlCache.get(shortId);
        if (!url) {
            await sock.sendMessage(from, { text: "❌ Tautan download sudah kedaluwarsa. Silakan kirim ulang tautan Anda." });
            return true;
        }

        // Kirim status awal download
        const progressMsg = await sock.sendMessage(from, {
            text: `⏳ *Sedang mengunduh ${downloadType === 'video' ? 'Video (' + quality + 'p)' : 'Audio (MP3)'}...*\n_Mohon tunggu sebentar, file sedang diproses..._`
        });

        // Buat folder temp jika belum ada
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const ext = downloadType === 'video' ? 'mp4' : 'mp3';
        const outputPath = path.join(tempDir, `iadl_${Date.now()}.${ext}`);

        try {
            if (downloadType === 'video') {
                // Konfigurasi format resolusi yt-dlp
                const formatSelector = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;
                await downloadVideo(url, formatSelector, outputPath);

                // Cek ukuran file hasil unduhan
                let stats = fs.statSync(outputPath);
                let fileSizeMB = stats.size / (1024 * 1024);

                // Auto compress jika ukuran file melebihi 25MB
                if (fileSizeMB > 25) {
                    await sock.sendMessage(from, {
                        text: `📦 *Mengompres video (${fileSizeMB.toFixed(2)}MB)...*`,
                        edit: progressMsg.key
                    });
                    const compressResult = await autoCompress(outputPath, 25, 'video');
                    if (compressResult.compressed) {
                        fileSizeMB = compressResult.newSize;
                    }
                }

                // Batasan maksimum pengiriman file WhatsApp (100MB)
                if (fileSizeMB > 100) {
                    fs.unlinkSync(outputPath);
                    await sock.sendMessage(from, {
                        text: '❌ File terlalu besar (>100MB)! Silakan pilih kualitas video yang lebih rendah.',
                        edit: progressMsg.key
                    });
                    return true;
                }

                // Kirim media video ke pengguna
                await sock.sendMessage(from, {
                    video: fs.readFileSync(outputPath),
                    caption: `✅ *Download Berhasil!*\n\n📺 Kualitas: ${quality}p\n📦 Ukuran: ${fileSizeMB.toFixed(2)}MB`,
                    mimetype: 'video/mp4'
                });

            } else {
                // Download Audio (MP3)
                await downloadAudio(url, quality, outputPath);

                // Cek ukuran file audio
                let stats = fs.statSync(outputPath);
                let fileSizeMB = stats.size / (1024 * 1024);

                // Auto compress jika ukuran file audio melebihi 25MB
                if (fileSizeMB > 25) {
                    await sock.sendMessage(from, {
                        text: `📦 *Mengompres audio (${fileSizeMB.toFixed(2)}MB)...*`,
                        edit: progressMsg.key
                    });
                    const compressResult = await autoCompress(outputPath, 25, 'audio');
                    if (compressResult.compressed) {
                        fileSizeMB = compressResult.newSize;
                    }
                }

                // Kirim media audio ke pengguna
                await sock.sendMessage(from, {
                    audio: fs.readFileSync(outputPath),
                    mimetype: 'audio/mpeg',
                    fileName: `audio_${Date.now()}.mp3`
                });
            }

            // Hapus file sementara dari disk setelah terkirim
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }

            // Update pesan status menjadi sukses
            await sock.sendMessage(from, {
                text: '✅ *Proses download selesai!*',
                edit: progressMsg.key
            });

        } catch (downloadErr) {
            console.error('[Interactive AutoDL] Error saat mengunduh:', downloadErr);
            await sock.sendMessage(from, {
                text: `❌ *Gagal mendownload media!*\n\n⚠️ Error: ${downloadErr.message}`,
                edit: progressMsg.key
            });
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        }

        return true;
    } catch (err) {
        console.error('[Interactive AutoDL] Gagal mengolah respon interaktif:', err);
        return false;
    }
}
