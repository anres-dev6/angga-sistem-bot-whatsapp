import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export default {
    name: 'ytgeo',
    aliases: ['ytgeo', 'ytbypass'],
    tags: ['download'],
    description: 'Download geo-restricted video dengan bypass',
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
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.ytgeo https://youtube.com/watch?v=xxx\n\n🌍 Untuk video yang geo-restricted"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Downloading geo-restricted content...*\n\n🌍 Bypassing geo-restriction"
            }, { quoted: msg });

            const outputPath = path.join(process.cwd(), 'temp', `geo_${Date.now()}.mp4`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Download with geo-bypass
            const downloadCmd = `yt-dlp --geo-bypass -f "best[height<=720]" -o "${outputPath}" "${url}"`;

            await execPromise(downloadCmd, {
                timeout: 180000,
                maxBuffer: 100 * 1024 * 1024
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
                caption: `🌍 *GEO-RESTRICTED CONTENT*\n\n📦 Size: ${fileSizeMB}MB\n✅ Downloaded with geo-bypass`,
                mimetype: 'video/mp4'
            });

            fs.unlinkSync(outputPath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[YTGeo] Error:', err);

            let errorMsg = '❌ *Gagal download!*\n\n';

            if (err.message.includes('geo')) {
                errorMsg += '🌍 Geo-bypass gagal.\n💡 Video mungkin benar-benar tidak tersedia.';
            } else {
                errorMsg += `⚠️ ${err.message}`;
            }

            await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
        }
    }
};
