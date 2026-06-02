import { downloadMediaMessage } from 'baileys';
import fetch from 'node-fetch';

export default {
    name: 'mp3',
    aliases: ['mp3', 'tomp3', 'toaudio'],
    tags: ['converter'],
    description: 'Convert video/link ke MP3',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args, { text }) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo;

        try {
            // Case 1: Reply to a video message
            if (quoted && quoted.quotedMessage?.videoMessage) {
                const quotedMsg = {
                    key: {
                        remoteJid: from,
                        id: quoted.stanzaId,
                        participant: quoted.participant
                    },
                    message: quoted.quotedMessage
                };

                await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

                try {
                    const videoBuffer = await downloadMediaMessage(
                        quotedMsg,
                        'buffer',
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );

                    await sock.sendMessage(from, {
                        audio: videoBuffer,
                        mimetype: 'audio/mpeg',
                        fileName: `audio_${Date.now()}.mp3`,
                        ptt: false
                    }, { quoted: msg });

                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                    await sock.sendMessage(from, { text: "Audio berhasil diproses!" }, { quoted: msg });
                    return;

                } catch (err) {
                    console.error('Download error:', err);
                    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(from, { text: "❌ Gagal mengunduh video." }, { quoted: msg });
                }
            }
            // Case 2: URL provided
            else if (args[0]) {
                const url = args[0];

                const isYouTube = /youtube\.com|youtu\.be/i.test(url);
                const isTikTok = /tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(url);
                const isSpotify = /spotify\.com\/track/i.test(url);

                if (!isYouTube && !isTikTok && !isSpotify) {
                    return sock.sendMessage(from, {
                        text: "❌ Link tidak didukung!\n\nYang didukung:\n• Spotify\n• TikTok\n• YouTube\n• Reply video WhatsApp"
                    }, { quoted: msg });
                }

                await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

                // Spotify
                if (isSpotify) {
                    try {
                        const apiUrl = `https://api.siputzx.my.id/api/d/spotifyv2?url=${encodeURIComponent(url)}`;

                        let response = await fetch(apiUrl, {
                            signal: AbortSignal.timeout(45000) // 45s timeout
                        });

                        // Check for rate limit (429 or check headers)
                        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
                        const rateLimitReset = response.headers.get('x-ratelimit-reset');

                        // If rate limited (429 Too Many Requests)
                        if (response.status === 429 || rateLimitRemaining === '0') {
                            const resetTime = parseInt(rateLimitReset) * 1000; // Convert to milliseconds
                            const now = Date.now();
                            const waitTime = Math.max(0, resetTime - now);
                            const waitSeconds = Math.ceil(waitTime / 1000);

                            // If wait time is reasonable (< 60 seconds), wait and retry
                            if (waitSeconds > 0 && waitSeconds <= 60) {
                                await sock.sendMessage(from, {
                                    text: `⏳ *Rate limit tercapai!*\n\nMenunggu ${waitSeconds} detik...\n\n💡 API Spotify memiliki limit 6 request per periode.`
                                }, { quoted: msg });

                                await new Promise(resolve => setTimeout(resolve, waitTime + 1000));

                                response = await fetch(apiUrl, {
                                    signal: AbortSignal.timeout(30000)
                                });
                            } else {
                                throw new Error(`Rate limit tercapai. Coba lagi dalam ${waitSeconds} detik.`);
                            }
                        }

                        if (!response.ok) {
                            throw new Error(`API returned ${response.status}`);
                        }

                        const data = await response.json();

                        if (!data.status) {
                            throw new Error('API returned status false');
                        }

                        if (!data.data || !data.data.download) {
                            throw new Error('No download URL in response');
                        }

                        const downloadUrl = data.data.download;
                        const title = data.data.title || 'spotify_audio';
                        const artist = data.data.artist || 'Unknown Artist';

                        const audioResponse = await fetch(downloadUrl, {
                            signal: AbortSignal.timeout(45000)
                        });

                        if (!audioResponse.ok) {
                            throw new Error(`Download failed: ${audioResponse.status}`);
                        }

                        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
                        await sock.sendMessage(from, {
                            audio: audioBuffer,
                            mimetype: 'audio/mpeg',
                            fileName: `${title}.mp3`,
                            ptt: false
                        }, { quoted: msg });

                        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

                        // Show remaining quota if low
                        let quotaWarning = '';
                        if (rateLimitRemaining && parseInt(rateLimitRemaining) <= 2) {
                            quotaWarning = `\n\n⚠️ Quota tersisa: ${rateLimitRemaining}/6`;
                        }

                        await sock.sendMessage(from, {
                            text: `🎵 *${title}*\n👤 ${artist}\n\n✅ Audio berhasil diunduh!${quotaWarning}`
                        }, { quoted: msg });

                    } catch (error) {
                        console.error('[Spotify] Error:', error.message);
                        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });

                        let errorMsg = `❌ Gagal mengunduh dari Spotify: ${error.message}`;

                        // Add helpful message based on error type
                        if (error.message.includes('Rate limit')) {
                            errorMsg += '\n\n💡 API Spotify memiliki limit 6 request per periode. Tunggu beberapa saat lalu coba lagi.';
                        } else if (error.message.includes('timeout') || error.message.includes('aborted')) {
                            errorMsg += '\n\n💡 API Spotify sedang lambat/sibuk. Coba lagi dalam beberapa saat.';
                        } else {
                            errorMsg += '\n\n💡 Pastikan link adalah link track Spotify yang valid.';
                        }

                        return sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
                    }
                }
                // TikTok
                if (isTikTok) {
                    try {
                        // Import TikTok scraper
                        const { Tiktok } = await import('@tobyg74/tiktok-api-dl');

                        const result = await Tiktok(url);

                        if (!result || result.status !== "success") {
                            throw new Error('Failed to scrape TikTok data');
                        }

                        const data = result.result;
                        let audioUrl = null;

                        // Get audio URL
                        if (data.music) {
                            audioUrl = data.music;
                        } else if (data.video?.noWatermark) {
                            audioUrl = data.video.noWatermark;
                        } else if (data.video?.playAddr) {
                            audioUrl = data.video.playAddr;
                        }

                        if (!audioUrl) {
                            throw new Error('No audio found');
                        }

                        const contentResponse = await fetch(audioUrl, {
                            signal: AbortSignal.timeout(45000)
                        });

                        if (!contentResponse.ok) {
                            throw new Error(`Download failed: ${contentResponse.status}`);
                        }

                        const contentBuffer = Buffer.from(await contentResponse.arrayBuffer());
                        await sock.sendMessage(from, {
                            audio: contentBuffer,
                            mimetype: 'audio/mpeg',
                            fileName: 'tiktok_audio.mp3',
                            ptt: false
                        }, { quoted: msg });

                        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
                        await sock.sendMessage(from, { text: "Audio berhasil diproses!" }, { quoted: msg });

                    } catch (error) {
                        console.error('[TikTok] Error:', error.message);
                        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                        return sock.sendMessage(from, {
                            text: `❌ Gagal: ${error.message}\n\n💡 Alternatif:\n1. Download video/audio TikTok\n2. Kirim ke bot\n3. Reply dengan .mp3`
                        }, { quoted: msg });
                    }
                }
                // YouTube
                else if (isYouTube) {
                    await sock.sendMessage(from, { react: { text: '💡', key: msg.key } });
                    return sock.sendMessage(from, {
                        text: `📥 *Cara Download Audio YouTube:*

API YouTube tidak stabil, gunakan cara ini:

*Opsi 1 - Website:*
1. Buka: https://y2mate.com
2. Paste link: ${url}
3. Download MP3
4. Kirim ke bot ✅

*Opsi 2 - Download Video:*
1. Download video YouTube
2. Kirim ke bot
3. Reply dengan .mp3 ✅

💡 Opsi 2 lebih mudah!`
                    }, { quoted: msg });
                }
            }
            // Case 3: No input
            else {
                return sock.sendMessage(from, {
                    text: `🎵 *MP3 Converter*

*Cara Pakai:*

*1. Video WhatsApp* ✅
   Reply video: .mp3

*2. Spotify* ✅
   .mp3 [link Spotify track]

*3. TikTok* ✅
   .mp3 [link TikTok]
   Support video & slideshow!

*4. YouTube* 💡
   .mp3 [link] → Dapat instruksi

*Contoh:*
.mp3 https://open.spotify.com/track/xxxxx
.mp3 https://vt.tiktok.com/xxxxx

💡 Paling mudah: Kirim video → .mp3`
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('[MP3] Error:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(from, {
                text: `❌ Error: ${error.message}`
            }, { quoted: msg });
        }
    }
}
