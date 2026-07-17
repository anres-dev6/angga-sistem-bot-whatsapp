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

if (!global.lastDetectedUrl) {
    global.lastDetectedUrl = new Map();
}

/**
 * Format numbers with local Indonesian formatting
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    if (num === undefined || num === null || num === 0) return '0';
    if (typeof num === 'string') return num;
    return num.toLocaleString('id-ID');
}

/**
 * Membuat ID pendek acak dan unik untuk menyimpan URL asli di Map
 * @param {string} url - URL asli yang akan diunduh
 * @returns {string} ID pendek unik
 */
function getShortId(url) {
    const id = Math.random().toString(36).substring(2, 8);
    global.interactiveDlCache.set(id, { url });
    // Hapus otomatis dari memori setelah 1 jam untuk efisiensi
    setTimeout(() => {
        const cached = global.interactiveDlCache.get(id);
        if (cached && typeof cached === 'object' && cached.videoPath) {
            try {
                if (fs.existsSync(cached.videoPath)) {
                    fs.unlinkSync(cached.videoPath);
                    console.log(`[Interactive AutoDL] Deleted cached video path: ${cached.videoPath}`);
                }
            } catch (err) {}
        }
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
    
    // Simpan ke lastDetectedUrl map
    global.lastDetectedUrl.set(jid, {
        url: url,
        platform: platform,
        shortId: shortId,
        timestamp: Date.now()
    });

    let buttons = [];
    let text = "";

    // 1. Jika platform TikTok, Instagram, atau Facebook (Sebagai cadangan jika dipanggil langsung)
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
                    display_text: "🎥 Video 1080p",
                    id: `iadl_${shortId}_video_1080`
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
 * Mengirimkan tombol MP3 saja di bawah video
 */
export async function sendMp3ButtonOnly(sock, jid, shortId, platform) {
    const text = `🎵 *Audio Options*\n\nIngin mendownload format MP3/Audio untuk media di atas? Silakan tekan tombol di bawah.`;
    const buttons = [
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "🎵 Download MP3 saja",
                id: `iadl_${shortId}_audio_128`
            })
        }
    ];

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

    await sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id
    });
}

/**
 * Mengunduh video tiktok, ig, fb langsung tanpa watermark, mengirimnya dengan caption metadata,
 * lalu memberikan tombol download MP3/audio.
 */
export async function handleDirectDownloadAndButtons(sock, jid, url, platform, m) {
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    
    // 1. Kirim status awal download
    const progressMsg = await sock.sendMessage(jid, {
        text: `⏳ *AutoDL - Downloading ${platformName} media...*\n_Mohon tunggu sebentar..._`
    }, { quoted: m });

    let outputPath = null;

    try {
        // 2. Resolve link menggunakan universalEngine AutoDL V3
        const { universalEngine } = await import('../autodlv3/engine/index.js');
        const result = await universalEngine(url, { m });

        if (!result) {
            throw new Error("Gagal memproses URL");
        }

        const shortId = getShortId(url);
        // Simpan url yang terdeteksi untuk pencarian perintah teks non-prefix
        global.lastDetectedUrl.set(jid, {
            url: url,
            platform: platform,
            shortId: shortId,
            timestamp: Date.now()
        });

        // 3. Jika berupa slide gambar (misal TikTok foto, Instagram post, Facebook album)
        if (result.type === 'image-slide') {
            // Filter hanya URL valid (string atau Buffer), singkirkan undefined/null
            const validImages = result.images.filter(img => img && (Buffer.isBuffer(img) || (typeof img === 'string' && img.startsWith('http'))));
            const numImages = validImages.length;
            console.log(`[Interactive AutoDL] Slide detected. Total valid images: ${numImages}, ShortID: ${shortId}`);

            if (numImages === 0) {
                throw new Error('Tidak ada gambar valid yang ditemukan dalam slideshow.');
            }

            if (numImages === 1) {
                // Proses fotonya saja tanpa lagu jika fotonya hanya 1
                await sock.sendMessage(jid, {
                    text: `✅ Terdeteksi 1 foto. Mengirim ke chat...`,
                    edit: progressMsg.key
                });

                const img = validImages[0];
                let imageBuffer = null;
                try {
                    if (Buffer.isBuffer(img)) {
                        imageBuffer = img;
                    } else if (typeof img === 'string') {
                        const axios = (await import('axios')).default;
                        console.log(`[Interactive AutoDL] Downloading single photo from: ${img}`);
                        const res = await axios.get(img, {
                            responseType: 'arraybuffer',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            timeout: 15000
                        });
                        imageBuffer = Buffer.from(res.data);
                    }
                } catch (dlErr) {
                    console.error('[Interactive AutoDL] Failed to download single photo buffer:', dlErr.message);
                }

                if (imageBuffer) {
                    await sock.sendMessage(jid, {
                        image: imageBuffer,
                        caption: result.title || `Media dari ${platformName}`
                    });
                } else {
                    const imagePayload = Buffer.isBuffer(img) ? img : { url: img };
                    await sock.sendMessage(jid, {
                        image: imagePayload,
                        caption: result.title || `Media dari ${platformName}`
                    });
                }

                try { await sock.sendMessage(jid, { delete: progressMsg.key }); } catch {}
                return;
            } else {
                // Slideshow mode - simpan ke cache (hanya gambar valid)
                console.log(`[Interactive AutoDL] Caching slideshow with ${numImages} slides under shortId: ${shortId}`);
                global.interactiveDlCache.set(shortId, {
                    url: url,
                    type: 'image-slide',
                    images: validImages,
                    platform: platform,
                    title: result.title || ''
                });

                const text = `📊 *AutoDL - Slideshow Terdeteksi*\n\n` +
                             `📱 Platform: *${platformName}*\n` +
                             `🖼️ Jumlah: *${numImages} slide*\n\n` +
                             `Silakan pilih metode pengiriman media di bawah ini:`;

                const buttons = [
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "📥 Kirim Ke Chat Ini",
                            id: `iadl_${shortId}_slide_public`
                        })
                    },
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: "👤 Kirim Ke Private Chat",
                            id: `iadl_${shortId}_slide_private`
                        })
                    }
                ];

                const buttonsMsg = generateWAMessageFromContent(jid, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                body: { text: text },
                                footer: { text: "Interactive Auto Downloader" },
                                nativeFlowMessage: { buttons: buttons }
                            }
                        }
                    }
                }, {});

                await sock.relayMessage(jid, buttonsMsg.message, { messageId: buttonsMsg.key.id });
                try { await sock.sendMessage(jid, { delete: progressMsg.key }); } catch {}
                return;
            }
        }

        // 4. Jika berupa video
        if (result.type === 'video') {
            let buffer;
            if (result.buffer) {
                buffer = result.buffer;
            } else if (result.url) {
                const { downloadWithProgress } = await import('../autodlv3/engine/progress.js');
                buffer = await downloadWithProgress(result.url, () => {});
            } else {
                throw new Error("Format video tidak dikenal");
            }

            // Simpan buffer ke folder temp sementara
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            outputPath = path.join(tempDir, `autodl_${Date.now()}.mp4`);
            fs.writeFileSync(outputPath, buffer);

            let stats = fs.statSync(outputPath);
            let fileSizeMB = stats.size / (1024 * 1024);

            // Kompres otomatis jika > 25MB
            if (fileSizeMB > 25) {
                await sock.sendMessage(jid, {
                    text: `📦 *Mengompres video (${fileSizeMB.toFixed(2)}MB)...*`,
                    edit: progressMsg.key
                });
                const compressResult = await autoCompress(outputPath, 25, 'video');
                if (compressResult.compressed) {
                    buffer = fs.readFileSync(outputPath);
                    fileSizeMB = compressResult.newSize;
                }
            }

            if (fileSizeMB > 100) {
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                throw new Error("Ukuran video melebihi batas pengiriman WhatsApp (100MB).");
            }

            // Susun caption lengkap dengan metadata
            const meta = result.metadata || {};
            let captionText = `✅ *Download Berhasil!*\n\n`;
            if (meta.caption) captionText += `📝 *Caption:* ${meta.caption.trim()}\n`;
            if (meta.author) captionText += `👤 *Akun:* ${meta.author}\n`;
            if (meta.views) captionText += `👁️ *Views:* ${formatNumber(meta.views)}\n`;
            if (meta.likes) captionText += `❤️ *Likes:* ${formatNumber(meta.likes)}\n`;
            if (meta.shares) captionText += `🔄 *Shares:* ${formatNumber(meta.shares)}\n`;
            
            captionText += `📦 *Size:* ${fileSizeMB.toFixed(2)} MB`;

            // Kirim media video ke pengguna
            await sock.sendMessage(jid, {
                video: buffer,
                caption: captionText,
                mimetype: 'video/mp4'
            });

            // Simpan path video ke dalam cache untuk dikonversi menjadi MP3 nanti
            const cached = global.interactiveDlCache.get(shortId);
            if (cached && typeof cached === 'object') {
                cached.videoPath = outputPath;
                global.interactiveDlCache.set(shortId, cached);
            } else {
                global.interactiveDlCache.set(shortId, { url, videoPath: outputPath });
            }

            // Kirim tombol MP3 di bawah video
            await sendMp3ButtonOnly(sock, jid, shortId, platform);

            // Hapus pesan progress
            try {
                await sock.sendMessage(jid, { delete: progressMsg.key });
            } catch {}
        }
    } catch (err) {
        console.error('[Interactive AutoDL] Direct Download Error:', err);
        if (outputPath && fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath);
            } catch (unlinkErr) {}
        }
        await sock.sendMessage(jid, {
            text: `❌ *Gagal download media!*\n\n⚠️ ${err.message}`,
            edit: progressMsg.key
        });
    }
}

/**
 * Fungsi pembantu yang melakukan esekusi pengunduhan media
 */
export async function handleDirectDownloadAction(sock, from, url, downloadType, quality, m) {
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
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                await sock.sendMessage(from, {
                    text: '❌ File terlalu besar (>100MB)! Silakan pilih kualitas video yang lebih rendah.',
                    edit: progressMsg.key
                });
                return;
            }

            // Kirim media video ke pengguna
            await sock.sendMessage(from, {
                video: fs.readFileSync(outputPath),
                caption: `✅ *Download Berhasil!*\n\n📺 Kualitas: ${quality}p\n📦 Ukuran: ${fileSizeMB.toFixed(2)}MB`,
                mimetype: 'video/mp4'
            });

        } else {
            // Download Audio (MP3)
            const mp3Path = await downloadAudio(url, quality, outputPath);

            // Cek ukuran file audio
            let stats = fs.statSync(mp3Path);
            let fileSizeMB = stats.size / (1024 * 1024);

            // Auto compress jika ukuran file audio melebihi 25MB
            if (fileSizeMB > 25) {
                await sock.sendMessage(from, {
                    text: `📦 *Mengompres audio (${fileSizeMB.toFixed(2)}MB)...*`,
                    edit: progressMsg.key
                });
                const compressResult = await autoCompress(mp3Path, 25, 'audio');
                if (compressResult.compressed) {
                    fileSizeMB = compressResult.newSize;
                }
            }

            // Kirim media audio ke pengguna
            let mimetype = 'audio/mpeg';
            if (mp3Path.endsWith('.m4a')) {
                mimetype = 'audio/mp4';
            } else if (mp3Path.endsWith('.ogg') || mp3Path.endsWith('.opus') || mp3Path.endsWith('.webm')) {
                mimetype = 'audio/ogg';
            }

            await sock.sendMessage(from, {
                audio: fs.readFileSync(mp3Path),
                mimetype: mimetype,
                fileName: `audio_${Date.now()}${path.extname(mp3Path)}`
            });

            if (fs.existsSync(mp3Path)) {
                fs.unlinkSync(mp3Path);
            }
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
}

/**
 * Menangani respon klik tombol interaktif dari event messages.upsert
 * @param {object} sock - Socket instance Baileys
 * @param {object} m - Objek pesan dari Baileys
 * @returns {Promise<boolean>} True jika event ditangani, false jika tidak
 */
export async function handleInteractiveResponse(sock, m, selectedIdArg = null) {
    const from = m.key.remoteJid;
    
    let selectedId = selectedIdArg;

    if (!selectedId) {
        // Fallback to checking m.message directly
        const interactiveResponse = m.message?.interactiveResponseMessage;
        const nativeFlowResponse = interactiveResponse?.nativeFlowResponseMessage;
        if (nativeFlowResponse?.paramsJson) {
            try {
                const params = JSON.parse(nativeFlowResponse.paramsJson);
                selectedId = params.id;
            } catch {}
        }
    }

    // Memvalidasi prefix ID tombol milik modul kita
    if (!selectedId || !selectedId.startsWith('iadl_')) return false;

    try {
        console.log('[Interactive AutoDL] Tombol ditekan dengan ID:', selectedId);

        const parts = selectedId.split('_');
        const shortId = parts[1];
        const downloadType = parts[2]; // 'video' atau 'audio'
        const quality = parts[3];      // '360', '480', '720', atau '128'

        // Mengambil URL asli dari penyimpanan Map
        const cachedEntry = global.interactiveDlCache.get(shortId);
        const url = (typeof cachedEntry === 'object' ? cachedEntry?.url : cachedEntry) || global.lastDetectedUrl.get(from)?.url;
        const videoPath = (typeof cachedEntry === 'object') ? cachedEntry?.videoPath : null;

        if (!url) {
            await sock.sendMessage(from, { text: "❌ Tautan download sudah kedaluwarsa. Silakan kirim ulang tautan Anda." });
            return true;
        }

        // Menangani aksi klik tombol slide (Kirim Pribadi / Kirim Sini)
        if (downloadType === 'slide') {
            const action = parts[3]; // 'private' atau 'public'
            console.log(`[Interactive AutoDL] Slide button pressed. Action: ${action}, ShortID: ${shortId}`);

            const cachedEntry = global.interactiveDlCache.get(shortId);
            console.log(`[Interactive AutoDL] Retrieved cache entry:`, cachedEntry ? { type: cachedEntry.type, imagesCount: cachedEntry.images?.length, platform: cachedEntry.platform } : null);

            if (!cachedEntry || cachedEntry.type !== 'image-slide') {
                console.log(`[Interactive AutoDL] Cache entry not found or invalid type for shortId: ${shortId}`);
                await sock.sendMessage(from, { text: "❌ Data slide sudah kedaluwarsa atau tidak ditemukan." });
                return true;
            }

            const images = cachedEntry.images;
            const isGroup = from.endsWith('@g.us');

            // Ambil JID pengirim dengan benar dari interactiveResponseMessage
            const senderRaw =
                m.message?.interactiveResponseMessage?.contextInfo?.participant ||
                m.key?.participant ||
                m.participant ||
                (isGroup ? null : from);

            // Bersihkan suffix device jika ada (misal :3@s.whatsapp.net → @s.whatsapp.net)
            const senderJid = senderRaw
                ? senderRaw.replace(/:\d+@/, '@')
                : from;

            const targetJid = action === 'private' ? senderJid : from;

            console.log(`[Interactive AutoDL] Sender: ${senderJid}, Action: ${action}, Target: ${targetJid}`);

            // Beri feedback pesan loading terlebih dahulu
            const infoText = action === 'private'
                ? `⏳ Mengirim *${images.length} slide* ke Private Chat Anda...`
                : `⏳ Mengirim *${images.length} slide* ke chat ini...`;

            await sock.sendMessage(from, { text: infoText }, { quoted: m });

            // Untuk private chat: test dulu apakah bot bisa kirim ke JID tsb
            if (action === 'private' && targetJid !== from) {
                try {
                    await sock.sendMessage(targetJid, {
                        text: `📥 *${images.length} slide* sedang dikirim ke sini dari permintaan Anda di grup...`
                    });
                } catch (testErr) {
                    console.error('[Interactive AutoDL] Private chat pre-test failed:', testErr.message);
                    await sock.sendMessage(from, {
                        text: `⚠️ *Gagal kirim ke Private Chat!*\n\nBot tidak bisa mengirim pesan ke private chat Anda.\n\n💡 Solusi: Mulai chat dulu dengan bot, lalu coba lagi.`
                    }, { quoted: m });
                    return true;
                }
            }

            // Kirim semua slide secara berurutan — PISAHKAN download dan send agar tidak duplikat
            let sentCount = 0;
            for (let i = 0; i < images.length; i++) {
                const img = images[i];

                // STEP 1: Resolve image payload (download buffer atau pakai URL langsung)
                let imagePayload = null;
                try {
                    if (Buffer.isBuffer(img)) {
                        imagePayload = img;
                    } else if (typeof img === 'string') {
                        const axios = (await import('axios')).default;
                        console.log(`[Interactive AutoDL] Fetching slide ${i + 1}/${images.length} from: ${img}`);
                        const res = await axios.get(img, {
                            responseType: 'arraybuffer',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            timeout: 20000
                        });
                        imagePayload = Buffer.from(res.data);
                    }
                } catch (dlErr) {
                    // Download buffer gagal → pakai URL langsung sebagai fallback
                    console.warn(`[Interactive AutoDL] Buffer download failed for slide ${i + 1}, using URL fallback:`, dlErr.message);
                    imagePayload = typeof img === 'string' ? { url: img } : null;
                }

                if (!imagePayload) {
                    console.error(`[Interactive AutoDL] No valid payload for slide ${i + 1}, skipping.`);
                    continue;
                }

                // STEP 2: Kirim sekali saja — tidak ada fallback kirim ulang di sini
                try {
                    await sock.sendMessage(targetJid, {
                        image: imagePayload,
                        caption: `🖼️ ${i + 1} / ${images.length}`
                    });
                    sentCount++;
                    console.log(`[Interactive AutoDL] Sent slide ${i + 1}/${images.length} to ${targetJid}`);
                } catch (sendErr) {
                    console.error(`[Interactive AutoDL] Send failed for slide ${i + 1}:`, sendErr.message);
                    if (action === 'private') {
                        await sock.sendMessage(from, {
                            text: `⚠️ Gagal mengirim slide ${i + 1}/${images.length} ke private chat.`
                        }).catch(() => {});
                    }
                }

                // Jeda kecil agar tidak spam
                await new Promise(r => setTimeout(r, 700));
            }

            console.log(`[Interactive AutoDL] Done. Sent ${sentCount}/${images.length} slides to ${targetJid}`);

            // Kirim konfirmasi akhir di grup
            await sock.sendMessage(from, {
                text: `✅ Berhasil mengirim *${sentCount}/${images.length} slide* ke ${action === 'private' ? 'private chat Anda' : 'chat ini'}.`
            }, { quoted: m });

            // Tawarkan MP3 jika dari tiktok
            if (cachedEntry.platform === 'tiktok') {
                await sendMp3ButtonOnly(sock, from, shortId, cachedEntry.platform);
            }
            return true;
        }


        if (downloadType === 'audio') {
            console.log('[Interactive AutoDL] Routing audio button click to mp3.js command');
            const mp3Command = (await import('../commands/download/mp3.js')).default;
            await mp3Command.run(sock, m, [url], {
                text: url,
                isOwner: false,
                isGroup: from.endsWith('@g.us'),
                isAdmin: false,
                sender: m.key.participant || m.participant || from,
                from: from,
                command: 'mp3',
                videoPath: videoPath
            });
            return true;
        }

        await handleDirectDownloadAction(sock, from, url, downloadType, quality, m);
        return true;
    } catch (err) {
        console.error('[Interactive AutoDL] Gagal mengolah respon interaktif:', err);
        return false;
    }
}

