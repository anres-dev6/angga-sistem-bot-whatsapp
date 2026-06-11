import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export default {
    name: 'ytlive',
    aliases: ['ytlive', 'livestream', 'live'],
    tags: ['download'],
    description: 'Download/record YouTube livestream',
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
                    text: "❌ Masukin link livestream!\n\n💡 Contoh:\n.ytlive https://youtube.com/watch?v=xxxxx"
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: "⏳ *Checking livestream...*"
            }, { quoted: msg });

            const { getYtdlpPath, getYtdlpBaseArgs } = await import('../../utils/ytdlpBinary.js');
            const ytdlpBin = getYtdlpPath().replace(/\\/g, '/');

            // Check if it's a live stream
            const infoCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} --dump-json "${url}"`;
            const { stdout } = await execPromise(infoCmd, { maxBuffer: 10 * 1024 * 1024 });
            const info = JSON.parse(stdout);

            if (!info.is_live && !info.was_live) {
                return sock.sendMessage(from, {
                    text: "❌ Ini bukan livestream!\n\n💡 Gunakan `.yt` untuk video biasa.",
                    edit: progressMsg.key
                });
            }

            if (info.is_live) {
                // Currently live - record
                await sock.sendMessage(from, {
                    text: `🔴 *LIVE STREAM DETECTED*\n\n` +
                        `📝 ${info.title}\n` +
                        `👤 ${info.uploader}\n\n` +
                        `⚠️ Recording live stream...\n` +
                        `⏱️ Max 5 menit`,
                    edit: progressMsg.key
                });

                const outputPath = path.join(process.cwd(), 'temp', `live_${Date.now()}.mp4`);
                const tempDir = path.join(process.cwd(), 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                // Record for max 5 minutes
                const recordCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} -f "best[height<=720]" --live-from-start --max-downloads 1 --download-sections "*0:00-5:00" -o "${outputPath.replace(/\\/g, '/')}" "${url}"`;

                await execPromise(recordCmd, {
                    timeout: 360000, // 6 minutes
                    maxBuffer: 100 * 1024 * 1024
                });

                if (!fs.existsSync(outputPath)) {
                    return sock.sendMessage(from, {
                        text: '❌ Gagal record livestream!',
                        edit: progressMsg.key
                    });
                }

                const stats = fs.statSync(outputPath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                if (stats.size > 100 * 1024 * 1024) {
                    fs.unlinkSync(outputPath);
                    return sock.sendMessage(from, {
                        text: '❌ Recording terlalu besar (>100MB)!',
                        edit: progressMsg.key
                    });
                }

                await sock.sendMessage(from, {
                    video: fs.readFileSync(outputPath),
                    caption: `🔴 *LIVE RECORDING*\n\n📝 ${info.title}\n📦 ${fileSizeMB}MB`,
                    mimetype: 'video/mp4'
                });

                fs.unlinkSync(outputPath);

            } else if (info.was_live) {
                // Live replay - download normally
                await sock.sendMessage(from, {
                    text: `📹 *LIVE REPLAY*\n\n` +
                        `📝 ${info.title}\n` +
                        `👤 ${info.uploader}\n\n` +
                        `⬇️ Downloading replay...`,
                    edit: progressMsg.key
                });

                const outputPath = path.join(process.cwd(), 'temp', `replay_${Date.now()}.mp4`);
                const tempDir = path.join(process.cwd(), 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const downloadCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} -f "best[height<=720]" -o "${outputPath.replace(/\\/g, '/')}" "${url}"`;

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
                    caption: `📹 *LIVE REPLAY*\n\n📝 ${info.title}\n📦 ${fileSizeMB}MB`,
                    mimetype: 'video/mp4'
                });

                fs.unlinkSync(outputPath);
            }

            await sock.sendMessage(from, {
                text: '✅ *Selesai!*',
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[YTLive] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
