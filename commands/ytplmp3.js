import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export default {
    name: 'ytplmp3',
    aliases: ['ytplmp3', 'playlistmp3'],
    tags: ['download'],
    description: 'Download YouTube playlist as MP3 (max 10 audio)',
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
        const { loadOwners } = await import('../utils/security.js');
        const owners = loadOwners();
        const isOwner = owners.includes(senderNumber);

        try {
            const url = args[0];
            let maxAudios = parseInt(args[1]) || 5;

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link playlist!\n\n💡 Contoh:\n.ytplmp3 https://youtube.com/playlist?list=xxx\n.ytplmp3 https://youtube.com/playlist?list=xxx 10"
                }, { quoted: msg });
            }

            // Limit based on user type
            if (!isOwner && maxAudios > 10) {
                maxAudios = 10;
            } else if (isOwner && maxAudios > 50) {
                maxAudios = 50;
            }

            const progressMsg = await sock.sendMessage(from, {
                text: `⏳ *Memproses playlist audio...*\n\n📊 Max: ${maxAudios} audio`
            }, { quoted: msg });

            const tempDir = path.join(process.cwd(), 'temp', `playlist_mp3_${Date.now()}`);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Download playlist as MP3
            const downloadCmd = `yt-dlp --playlist-end ${maxAudios} -x --audio-format mp3 --audio-quality 192K -o "${path.join(tempDir, '%(playlist_index)s - %(title)s.%(ext)s')}" "${url}"`;

            console.log('[PlaylistMP3] Downloading...');

            await execPromise(downloadCmd, {
                timeout: 300000, // 5 minutes
                maxBuffer: 100 * 1024 * 1024
            });

            // Get downloaded files
            const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.mp3'));

            if (files.length === 0) {
                fs.rmdirSync(tempDir, { recursive: true });
                return sock.sendMessage(from, {
                    text: '❌ Tidak ada audio yang berhasil didownload!',
                    edit: progressMsg.key
                });
            }

            await sock.sendMessage(from, {
                text: `📤 *Mengirim ${files.length} audio...*`,
                edit: progressMsg.key
            });

            // Send each audio
            for (let i = 0; i < files.length; i++) {
                const filePath = path.join(tempDir, files[i]);
                const stats = fs.statSync(filePath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                if (stats.size > 100 * 1024 * 1024) {
                    console.log(`[PlaylistMP3] Skipping ${files[i]} - too large`);
                    continue;
                }

                await sock.sendMessage(from, {
                    audio: fs.readFileSync(filePath),
                    mimetype: 'audio/mpeg',
                    fileName: files[i]
                });

                // Small delay to avoid spam
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Cleanup
            fs.rmdirSync(tempDir, { recursive: true });

            await sock.sendMessage(from, {
                text: `✅ *Selesai!*\n\n📊 Terkirim: ${files.length} audio`,
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[PlaylistMP3] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download playlist!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
