import { getVideoInfo, formatDuration, downloadYTDLPAudio } from '../../utils/ytdlp.js';
import fs from 'fs';
import path from 'path';

export default {
    name: 'play',
    aliases: ['play', 'song', 'musik'],
    tags: ['download'],
    description: 'Search dan download musik dari YouTube langsung ke MP3',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const input = args.join(' ');
        let progressMsg;

        const safeReact = async (emoji) => {
            try {
                await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
            } catch (err) {
                console.warn('[Play] Failed to send reaction:', err.message);
            }
        };

        if (!input) {
            return sock.sendMessage(from, {
                text: "❌ Masukin judul lagu atau link YouTube!\n\n💡 Contoh:\n.play dewa 19 - kangen\n.play dewa 19 kangen\n.play https://youtu.be/xxxxx"
            }, { quoted: msg });
        }

        try {
            await safeReact('⏳');

            progressMsg = await sock.sendMessage(from, {
                text: `🔍 *Mencari:* "${input}"...\n*Mohon tunggu sebentar.*`
            }, { quoted: msg });

            let url = input;
            let title = '';
            let duration = '';
            let uploader = 'Unknown';
            let info;

            const isUrl = /youtube\.com|youtu\.be/i.test(input);

            if (isUrl) {
                // Direct URL
                info = await getVideoInfo(input);
                url = input;
            } else {
                // Search query
                const searchQuery = `ytsearch1:${input}`;
                info = await getVideoInfo(searchQuery);
                if (!info || !info.id) {
                    throw new Error('Lagu tidak ditemukan. Coba kata kunci lain.');
                }
                url = `https://youtube.com/watch?v=${info.id}`;
            }

            title = info.title || 'Music';
            duration = formatDuration(info.duration);
            uploader = info.uploader || info.channel || 'Unknown';

            // Clean title for display
            const cleanTitle = title.replace(/[\[\]]/g, '').trim();

            await sock.sendMessage(from, {
                text: `🎵 *Music Found!*\n\n📝 *Judul:* ${cleanTitle}\n⏱️ *Durasi:* ${duration}\n👤 *Uploader:* ${uploader}\n\n📥 *Sedang mendownload MP3...*`,
                edit: progressMsg.key
            });

            // Download MP3 using standard 128kbps quality
            const result = await downloadYTDLPAudio(url, '128');

            if (!result || !result.filePath || !fs.existsSync(result.filePath)) {
                throw new Error('Gagal mendownload audio dari YouTube.');
            }

            const stats = fs.statSync(result.filePath);
            const fileSizeMB = stats.size / (1024 * 1024);

            if (fileSizeMB > 100) {
                fs.unlinkSync(result.filePath);
                throw new Error('Ukuran file audio terlalu besar (>100MB)!');
            }

            await sock.sendMessage(from, {
                text: `📤 *Mengirim audio "${cleanTitle}"...*`,
                edit: progressMsg.key
            });

            // Sanitize filename
            const safeFilename = cleanTitle.replace(/[\\/:*?"<>|]/g, '').trim();

            await sock.sendMessage(from, {
                audio: fs.readFileSync(result.filePath),
                mimetype: 'audio/mpeg',
                fileName: `${safeFilename}.mp3`,
                ptt: false
            }, { quoted: msg });

            // Clean up temporary file
            if (fs.existsSync(result.filePath)) {
                fs.unlinkSync(result.filePath);
            }

            // Success reaction and final update
            await safeReact('✅');
            await sock.sendMessage(from, {
                text: `✅ *Selesai!*\n\n🎵 *${cleanTitle}* berhasil dikirim.\n⏱️ Durasi: ${duration}\n📦 Ukuran: ${fileSizeMB.toFixed(2)} MB`,
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[Play] Error:', err);
            await safeReact('❌');

            let errorMsg = '❌ *Gagal memutar lagu!*\n\n';
            if (err.message.includes('tidak ditemukan')) {
                errorMsg += '🔍 Lagu tidak ditemukan. Coba kata kunci yang lebih spesifik.';
            } else if (err.message.includes('private')) {
                errorMsg += '🔒 Video private atau age-restricted.';
            } else if (err.message.includes('terlalu besar')) {
                errorMsg += '📦 Ukuran file audio melebihi batas 100MB.';
            } else {
                errorMsg += `⚠️ ${err.message}`;
            }

            if (progressMsg && progressMsg.key) {
                await sock.sendMessage(from, { text: errorMsg, edit: progressMsg.key });
            } else {
                await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
            }
        }
    }
};
