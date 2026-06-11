import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export default {
    name: 'ytaudio',
    aliases: ['ytaudio', 'ytaud'],
    tags: ['download'],
    description: 'Download audio dengan pilihan format (MP3, M4A, OPUS, OGG, FLAC)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        try {
            const url = args[0];
            const format = args[1] || 'mp3'; // Default MP3

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.ytaudio https://youtu.be/xxx\n.ytaudio https://youtu.be/xxx opus\n.ytaudio https://youtu.be/xxx flac\n\n📊 Format: mp3, m4a, opus, ogg, flac"
                }, { quoted: msg });
            }

            const validFormats = ['mp3', 'm4a', 'opus', 'ogg', 'flac'];
            if (!validFormats.includes(format.toLowerCase())) {
                return sock.sendMessage(from, {
                    text: `❌ Format tidak valid!\n\n✅ Format yang tersedia:\n• mp3\n• m4a\n• opus\n• ogg\n• flac`
                }, { quoted: msg });
            }

            const progressMsg = await sock.sendMessage(from, {
                text: `⏳ *Mendownload audio (${format.toUpperCase()})...*`
            }, { quoted: msg });

            const outputPath = path.join(process.cwd(), 'temp', `audio_${Date.now()}.${format}`);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const { getYtdlpPath, getYtdlpBaseArgs } = await import('../../utils/ytdlpBinary.js');
            const ytdlpBin = getYtdlpPath().replace(/\\/g, '/');
            const safeOutputPath = outputPath.replace(/\\/g, '/');

            let downloadCmd;
            if (format === 'm4a') {
                // M4A: Download best audio without conversion
                downloadCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} -f "bestaudio[ext=m4a]/bestaudio" -o "${safeOutputPath}" "${url}"`;
            } else if (format === 'flac') {
                // FLAC: Lossless quality
                downloadCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} -x --audio-format flac -o "${safeOutputPath}" "${url}"`;
            } else {
                // MP3, OPUS, OGG: Convert with quality
                const quality = format === 'mp3' ? '320K' : '192K';
                downloadCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} -x --audio-format ${format} --audio-quality ${quality} -o "${safeOutputPath}" "${url}"`;
            }

            await execPromise(downloadCmd, {
                timeout: 120000,
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

            const mimeTypes = {
                mp3: 'audio/mpeg',
                m4a: 'audio/mp4',
                opus: 'audio/opus',
                ogg: 'audio/ogg',
                flac: 'audio/flac'
            };

            await sock.sendMessage(from, {
                audio: fs.readFileSync(outputPath),
                mimetype: mimeTypes[format],
                fileName: `audio.${format}`
            });

            fs.unlinkSync(outputPath);

            await sock.sendMessage(from, {
                text: `✅ *Selesai!*\n\n📊 Format: ${format.toUpperCase()}\n📦 Size: ${fileSizeMB}MB`,
                edit: progressMsg.key
            });

        } catch (err) {
            console.error('[YTAudio] Error:', err);
            await sock.sendMessage(from, {
                text: `❌ *Gagal download!*\n\n⚠️ ${err.message}`
            }, { quoted: msg });
        }
    }
};
