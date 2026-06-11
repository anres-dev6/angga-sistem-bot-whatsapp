import { exec } from 'child_process';
import { promisify } from 'util';
import { sendAudioQualityList } from '../../utils/interactiveMessage.js';

const execPromise = promisify(exec);

export default {
    name: 'play',
    aliases: ['play', 'song', 'musik'],
    tags: ['download'],
    description: 'Search dan download musik dari YouTube',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        let progressMsg;

        try {
            const input = args.join(' ');

            if (!input) {
                return sock.sendMessage(from, {
                    text: "❌ Masukin judul lagu atau link YouTube!\n\n💡 Contoh:\n.play dewa 19 kangen\n.play https://youtu.be/xxxxx"
                }, { quoted: msg });
            }

            progressMsg = await sock.sendMessage(from, {
                text: `🔍 *Searching...*\n\n🎵 "${input}"`
            }, { quoted: msg });

            console.log('[Play] Processing:', input);

            let url, title, duration;

            const { getYtdlpPath, getYtdlpBaseArgs } = await import('../../utils/ytdlpBinary.js');
            const ytdlpBin = getYtdlpPath().replace(/\\/g, '/');

            // Check if input is URL or search query
            if (input.includes('youtube.com') || input.includes('youtu.be')) {
                // Direct URL
                url = input;

                // Get video info
                try {
                    const infoCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} --get-title --get-duration "${url}"`;
                    const { stdout } = await execPromise(infoCmd, { timeout: 10000 });
                    const lines = stdout.trim().split('\n');
                    title = lines[0] || 'Unknown';
                    duration = lines[1] || 'N/A';
                } catch (err) {
                    title = 'Unknown';
                    duration = 'N/A';
                }
            } else {
                // Search query
                try {
                    const searchCmd = `"${ytdlpBin}" ${getYtdlpBaseArgs()} "ytsearch1:${input}" --get-id --get-title --get-duration`;
                    const { stdout } = await execPromise(searchCmd, { timeout: 15000 });

                    const lines = stdout.trim().split('\n');
                    title = lines[0] || 'Unknown';
                    const videoId = lines[1] || '';
                    duration = lines[2] || 'N/A';

                    if (!videoId) {
                        throw new Error('Lagu tidak ditemukan');
                    }

                    url = `https://youtube.com/watch?v=${videoId}`;
                    console.log('[Play] Found:', title);
                } catch (err) {
                    console.error('[Play] Search error:', err);
                    throw new Error('Gagal mencari lagu. Coba kata kunci lain.');
                }
            }

            // Send interactive quality list
            await sendAudioQualityList(sock, from, title, duration, url);

            // Delete progress message
            await sock.sendMessage(from, {
                delete: progressMsg.key
            });

        } catch (err) {
            console.error('[Play] Error:', err.message);

            let errorMsg = '❌ *Gagal!*\n\n';

            if (err.message.includes('tidak ditemukan') || err.message.includes('No video')) {
                errorMsg += '🔍 Lagu tidak ditemukan.\n💡 Coba kata kunci yang lebih spesifik atau gunakan link YouTube langsung.';
            } else if (err.message.includes('private')) {
                errorMsg += '🔒 Video private atau age-restricted.';
            } else {
                errorMsg += `⚠️ ${err.message}\n\n💡 Tips:\n• Gunakan link YouTube langsung\n• Coba kata kunci lebih spesifik`;
            }

            if (progressMsg && progressMsg.key) {
                await sock.sendMessage(from, { text: errorMsg, edit: progressMsg.key });
            } else {
                await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
            }
        }
    }
};
