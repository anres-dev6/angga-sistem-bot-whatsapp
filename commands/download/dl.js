import { getVideoInfo, downloadVideo, downloadAudio } from '../../utils/ytdlp.js';
import { detectPlatform, getPlatformEmoji } from '../../utils/platformDetector.js';
import fs from 'fs';
import path from 'path';

export default {
    name: 'dl',
    aliases: ['dl', 'download'],
    tags: ['download'],
    description: 'Download dari platform apapun (YouTube, Instagram, TikTok, Twitter, dll)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        let progressMsg;

        try {
            const url = args[0];

            if (!url) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin link!\n\n💡 Contoh:\n.dl https://instagram.com/xxx\n.dl https://tiktok.com/xxx\n.dl https://twitter.com/xxx\n\n📋 Support 1000+ platform!"
                }, { quoted: msg });
            }

            // Detect platform
            const platform = detectPlatform(url);

            if (!platform) {
                return sock.sendMessage(from, {
                    text: "❌ Platform tidak dikenali!\n\n💡 Pastikan link valid dari platform yang didukung."
                }, { quoted: msg });
            }

            const emoji = getPlatformEmoji(platform.platform);
            progressMsg = await sock.sendMessage(from, {
                text: `⏳ *Mendownload dari ${platform.name}...*\n\n${emoji} Platform: ${platform.name}\n📦 Type: ${platform.type}`
            }, { quoted: msg });

            console.log(`[DL] Downloading from ${platform.name}:`, url);

            // Intercept new platforms to resolve and download directly via V3 resolvers
            const v3Platforms = ['capcut', 'canva', 'melolo', 'pinedrama', 'douyin'];
            if (v3Platforms.includes(platform.platform)) {
                await sock.sendMessage(from, {
                    text: `⬇️ *Mengunduh dari ${platform.name}...*\n\n_Mohon tunggu, proses otomatis sedang berlangsung..._`,
                    edit: progressMsg.key
                });

                try {
                    const resolverModule = await import(`../../autodlv3/resolvers/${platform.platform}.js`);
                    const resolver = resolverModule.default;
                    const result = await resolver(url);

                    if (result) {
                        let buffer;
                        if (result.buffer) {
                            buffer = result.buffer;
                        } else if (result.url) {
                            const axios = (await import('axios')).default;
                            const response = await axios.get(result.url, { responseType: 'arraybuffer', timeout: 60000 });
                            buffer = Buffer.from(response.data);
                        }

                        if (buffer) {
                            const caption = `${emoji} *${platform.name} Downloader*\n\n` +
                                `📦 Size: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB\n` +
                                `✅ Downloaded successfully`;

                            await sock.sendMessage(from, {
                                video: buffer,
                                caption: caption,
                                mimetype: 'video/mp4'
                            }, { quoted: msg });

                            await sock.sendMessage(from, {
                                text: '✅ *Selesai!*',
                                edit: progressMsg.key
                            });
                            return;
                        }
                    }
                } catch (v3Err) {
                    console.error(`[DL - V3 Platform] Failed resolving ${platform.platform}:`, v3Err);
                    throw new Error(`Gagal memproses link ${platform.name}: ${v3Err.message}`);
                }
            }

            // Try yt-dlp first
            try {
                // Get video info
                let info;
                try {
                    info = await getVideoInfo(url);
                } catch (error) {
                    console.error('[DL] Failed to get info:', error);
                }

                // Determine if audio or video
                const isAudio = platform.type === 'audio' || platform.platform === 'soundcloud' || platform.platform === 'bandcamp' || platform.platform === 'spotify';

                const outputPath = path.join(process.cwd(), 'temp', `dl_${Date.now()}.${isAudio ? 'mp3' : 'mp4'}`);
                const tempDir = path.join(process.cwd(), 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                await sock.sendMessage(from, {
                    text: `⬇️ *Downloading...*\n\n_Mohon tunggu..._`,
                    edit: progressMsg.key
                });

                if (isAudio) {
                    await downloadAudio(url, '192', outputPath);

                    await sock.sendMessage(from, {
                        audio: fs.readFileSync(outputPath),
                        mimetype: 'audio/mpeg',
                        fileName: `${platform.name}_audio.mp3`
                    });
                } else {
                    await downloadVideo(url, 'best', outputPath);

                    const stats = fs.statSync(outputPath);
                    const fileSizeMB = stats.size / (1024 * 1024);

                    if (fileSizeMB > 100) {
                        fs.unlinkSync(outputPath);
                        return sock.sendMessage(from, {
                            text: '❌ File terlalu besar (>100MB)!\n\n💡 Coba platform lain atau gunakan link yang lebih pendek.',
                            edit: progressMsg.key
                        });
                    }

                    const caption = `${emoji} *${platform.name}*\n\n` +
                        (info?.title ? `📝 ${info.title}\n` : '') +
                        `📦 Size: ${fileSizeMB.toFixed(2)}MB\n` +
                        `✅ Downloaded successfully`;

                    await sock.sendMessage(from, {
                        video: fs.readFileSync(outputPath),
                        caption: caption,
                        mimetype: 'video/mp4'
                    });
                }

                fs.unlinkSync(outputPath);

                await sock.sendMessage(from, {
                    text: '✅ *Selesai!*',
                    edit: progressMsg.key
                });

            } catch (ytdlpError) {
                console.error('[DL] yt-dlp failed, trying fallback:', ytdlpError.message);

                // Fallback to existing commands
                const fallbackCommands = {
                    'tiktok': 'tt',
                    'instagram': 'ig',
                    'facebook': 'fb'
                };

                const fallbackCmd = fallbackCommands[platform.platform];

                if (fallbackCmd) {
                    await sock.sendMessage(from, {
                        text: `🔄 *Trying alternative method...*\n\n${emoji} Using .${fallbackCmd} command`,
                        edit: progressMsg.key
                    });

                    // Import and run fallback command
                    const { default: fallbackCommand } = await import(`./${fallbackCmd}.js`);
                    await fallbackCommand.run(sock, msg, [url]);
                    return;
                } else {
                    // No fallback available, throw error
                    throw ytdlpError;
                }
            }

        } catch (err) {
            console.error('[DL] Error:', err);

            let errorMsg = '❌ *Gagal download!*\n\n';

            if (err.message.includes('private')) {
                errorMsg += '🔒 Konten private atau memerlukan login.';
            } else if (err.message.includes('not available') || err.message.includes('Unable to extract')) {
                errorMsg += '🚫 Konten tidak tersedia atau platform sedang bermasalah.\n💡 Coba lagi nanti atau gunakan command spesifik (.tt, .ig, .fb)';
            } else if (err.message.includes('geo')) {
                errorMsg += '🌍 Konten tidak tersedia di region ini.';
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
