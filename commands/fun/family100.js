import axios from "axios";

export default {
    name: 'family100',
    aliases: ['family100', 'f100'],
    tags: ['game'],
    description: 'Main game family 100',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m, args, { text, isGroup }) => {
        const from = m.key.remoteJid;

        if (!global.family100) global.family100 = {};

        // Start new game
        if (from in global.family100) {
            return sock.sendMessage(from, { text: '❌ Masih ada game yang belum diselesaikan!\n\n💡 Ketik *nyerah* untuk menyerah atau *clue* untuk bantuan.' }, { quoted: m });
        }

        try {
            const { data } = await axios.get("https://api.siputzx.my.id/api/games/family100");

            if (!data.status) throw new Error("API Error");

            const { soal, jawaban } = data.data;

            // Build initial message with question and board
            const buildMessage = (timeLeft, terjawab = []) => {
                const board = jawaban.map((j, i) => {
                    return terjawab.includes(i) ? `${i + 1}. ${j}` : `${i + 1}. ???`;
                }).join('\n');

                return `🎮 *FAMILY 100* 🎮\n\n` +
                    `*Soal:* ${soal}\n\n` +
                    `⏱️ *Waktu:* ${timeLeft} detik\n` +
                    `📊 *Jawaban:* ${terjawab.length}/${jawaban.length}\n\n` +
                    `${board}\n\n` +
                    `💡 *Bantuan:*\n` +
                    `• Ketik *clue* untuk 3 jawaban\n` +
                    `• Ketik *nyerah* untuk menyerah`;
            };

            // Send initial message
            const sentMsg = await sock.sendMessage(from, {
                text: buildMessage(120, [])
            });

            let timeLeft = 120;

            // Update countdown every 5 seconds
            const countdownInterval = setInterval(async () => {
                timeLeft -= 5;

                if (timeLeft > 0 && global.family100[from]) {
                    try {
                        await sock.sendMessage(from, {
                            text: buildMessage(timeLeft, global.family100[from].terjawab),
                            edit: sentMsg.key
                        });
                    } catch (error) {
                        console.error('[Family100] Countdown error:', error);
                    }
                } else {
                    clearInterval(countdownInterval);
                }
            }, 5000);

            // Main timeout
            const timeout = setTimeout(async () => {
                clearInterval(countdownInterval);

                if (global.family100[from]) {
                    const unAnswered = jawaban.filter((_, i) => !global.family100[from].terjawab.includes(i));

                    try {
                        await sock.sendMessage(from, {
                            text: buildMessage(0, global.family100[from].terjawab) + `\n\n⏰ *WAKTU HABIS!*`,
                            edit: sentMsg.key
                        });
                    } catch (error) {
                        console.error('[Family100] Timeout error:', error);
                    }

                    await sock.sendMessage(from, {
                        text: `*Game Berakhir!*\n\nJawaban yang belum terjawab:\n${unAnswered.map((j, i) => `${i + 1}. ${j}`).join('\n')}`
                    });

                    delete global.family100[from];
                }
            }, 120000);

            global.family100[from] = {
                id: from,
                soal: soal,
                jawaban: jawaban.map(j => j.toLowerCase()),
                terjawab: [],
                clueUsed: false,
                timeout: timeout,
                countdownInterval: countdownInterval,
                messageKey: sentMsg.key,
                buildMessage: buildMessage,
                startTime: Date.now()
            };

        } catch (error) {
            console.error('[Family100] Error:', error);
            return sock.sendMessage(from, { text: '❌ Terjadi kesalahan saat mengambil soal. Coba lagi nanti!' }, { quoted: m });
        }
    }
};
