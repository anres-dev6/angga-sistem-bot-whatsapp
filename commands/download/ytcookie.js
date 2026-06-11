import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export default {
    name: 'ytcookie',
    aliases: ['ytcookie', 'ytprivate'],
    tags: ['download'],
    description: 'Download private/member-only video dengan cookies (Owner only)',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            const url = args[0];

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.ytcookie https://youtube.com/watch?v=xxx\n\n⚠️ Pastikan cookies.txt sudah ada di folder bot!"
                }, { quoted: msg });
            }

            const cookiesPath = path.join(process.cwd(), 'cookies.txt');

            if (!fs.existsSync(cookiesPath)) {
                return sock.sendMessage(from, {
                    text: "❌ File cookies.txt tidak ditemukan!\n\n💡 Cara setup:\n1. Install browser extension 'Get cookies.txt'\n2. Login ke YouTube\n3. Export cookies.txt\n4. Upload ke folder bot"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Downloading private content...*\n\n🔐 Using cookies for authentication"
            }, { quoted: msg });

            const outputPath = path.join(process.cwd(), 'temp', `private_${Date.now()}.mp4`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const { getYtdlpPath, getYtdlpBaseArgs } = await import('../../utils/ytdlpBinary.js');
            const ytdlpBin = getYtdlpPath().replace(/\\/g, '/');
            const safeCookiesPath = cookiesPath.replace(/\\/g, '/');

            // Download with cookies
            const downloadCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} --cookies "${safeCookiesPath}" -f "best[height<=720]" -o "${outputPath.replace(/\\/g, '/')}" "${url}"`;

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
                caption: `🔐 *PRIVATE CONTENT*\n\n📦 Size: ${fileSizeMB}MB\n✅ Downloaded with cookies`,
                mimetype: 'video/mp4'
            });

            fs.unlinkSync(outputPath);

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[YTCookie] Error:', err);

            let errorMsg = '❌ *Gagal download!*\n\n';

            if (err.message.includes('login')) {
                errorMsg += '🔐 Cookies tidak valid atau expired.\n💡 Update cookies.txt dengan yang baru.';
            } else if (err.message.includes('private')) {
                errorMsg += '🔒 Video tetap tidak bisa diakses.\n💡 Pastikan akun yang login punya akses.';
            } else {
                errorMsg += `⚠️ ${err.message}`;
            }

            await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
        }
    }
};
