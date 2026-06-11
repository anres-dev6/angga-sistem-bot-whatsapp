import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export default {
    name: 'm4a',
    aliases: ['m4a', 'aac'],
    tags: ['download'],
    description: 'Download audio in M4A format (original quality)',
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
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.m4a https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Mendownload M4A...*"
            }, { quoted: msg });

            const outputPath = path.join(process.cwd(), 'temp', `m4a_${Date.now()}.m4a`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const { getYtdlpPath, getYtdlpBaseArgs } = await import('../../utils/ytdlpBinary.js');
            const ytdlpBin = getYtdlpPath().replace(/\\/g, '/');

            // Download best audio in M4A format (no conversion)
            const downloadCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} -f "bestaudio[ext=m4a]/bestaudio" -o "${outputPath.replace(/\\/g, '/')}" "${url}"`;

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
                audio: fs.readFileSync(outputPath),
                mimetype: 'audio/mp4',
                fileName: `audio.m4a`
            });

            fs.unlinkSync(outputPath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[M4A] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
