import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export default {
    name: 'ytpl',
    aliases: ['ytpl', 'playlist'],
    tags: ['download'],
    description: 'Download YouTube playlist (max 10 videos)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        // Check if owner
        const senderNumber = sender.split('@')[0].replace(/\D/g, '');
        const { loadOwners } = await import('../../utils/security.js');
        const owners = loadOwners();
        const isOwner = owners.includes(senderNumber);

        try {
            const url = args[0];
            let maxVideos = parseInt(args[1]) || 5;

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link playlist!\n\n💡 Contoh:\n.ytpl https://youtube.com/playlist?list=xxx\n.ytpl https://youtube.com/playlist?list=xxx 10"
                }, { quoted: msg });
            }

            // Limit based on user type
            if (!isOwner && maxVideos > 10) {
                maxVideos = 10;
            } else if (isOwner && maxVideos > 50) {
                maxVideos = 50;
            }

            const progressMsg = await sock.sendMessage(from, {
                text: `⏳ *Memproses playlist...*\n\n📊 Max: ${maxVideos} video`
            }, { quoted: msg });

            const tempDir = path.join(process.cwd(), 'temp', `playlist_${Date.now()}`);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Download playlist
            const downloadCmd = `yt-dlp --playlist-end ${maxVideos} -f "best[height<=720]" -o "${path.join(tempDir, '%(playlist_index)s - %(title)s.%(ext)s')}" "${url}"`;

            console.log('[Playlist] Downloading...');

            await execPromise(downloadCmd, {
                timeout: 300000, // 5 minutes
                maxBuffer: 100 * 1024 * 1024
            });

            // Get downloaded files
            const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.mp4') || f.endsWith('.webm'));

            if (files.length === 0) {
                fs.rmdirSync(tempDir, { recursive: true });
                return sock.sendMessage(from, {
                    text: '❌ Tidak ada video yang berhasil didownload!',
                    edit: progressMsg.key
                });
            }

            await sock.sendMessage(from, {
                text: `📤 *Mengirim ${files.length} video...*`,
                edit: progressMsg.key
            });

            // Send each video
            for (let i = 0; i < files.length; i++) {
                const filePath = path.join(tempDir, files[i]);
                const stats = fs.statSync(filePath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                if (stats.size > 100 * 1024 * 1024) {
                    console.log(`[Playlist] Skipping ${files[i]} - too large`);
                    continue;
                }

                await sock.sendMessage(from, {
                    video: fs.readFileSync(filePath),
                    caption: `📹 Video ${i + 1}/${files.length}\n📦 ${fileSizeMB}MB`,
                    mimetype: 'video/mp4'
                });

                // Small delay to avoid spam
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Cleanup
            fs.rmdirSync(tempDir, { recursive: true });

            await sock.sendMessage(from, {
                text: `✅ *Selesai!*\n\n📊 Terkirim: ${files.length} video`,
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[Playlist] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download playlist!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
