import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export default {
    name: 'short',
    aliases: ['short', 'shorts', 'reel', 'reels'],
    tags: ['download'],
    description: 'Download Shorts/Reels (optimized for vertical video)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            const url = args[0];

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.short https://youtube.com/shorts/xxx\n.short https://instagram.com/reel/xxx\n.short https://tiktok.com/xxx"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mendownload Shorts/Reels...*"
            }, { quoted: msg });

            const outputPath = path.join(process.cwd(), 'temp', `short_${Date.now()}.mp4`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Download best vertical video (height <= 1920)
            const downloadCmd = `yt-dlp -f "best[height<=1920]" -o "${outputPath}" "${url}"`;

            await execPromise(downloadCmd, {
                timeout: 60000,
                maxBuffer: 50 * 1024 * 1024
            });

            const stats = fs.statSync(outputPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            if (stats.size > 100 * 1024 * 1024) {
                fs.unlinkSync(outputPath);
                return sock.sendMessage(from, {
                    text: '❌ File terlalu besar (>100MB)!',
                    edit: progressMsg.key
                });
            }

            await sock.sendMessage(from, {
                video: fs.readFileSync(outputPath),
                caption: `📱 *Shorts/Reels*\n\n📦 Size: ${fileSizeMB}MB\n✅ Optimized for vertical video`,
                mimetype: 'video/mp4'
            });

            fs.unlinkSync(outputPath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[Short] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
