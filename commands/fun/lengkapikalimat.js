import fetch from "node-fetch";
import { hasActiveGame, getGameDisplayName, generateScrambledClue, startGameCountdown } from "../../utils/gameHelper.js";

export default {
    name: 'lengkapikalimat',
    aliases: ['lengkapikalimat', 'lk'],
    tags: ['game'],
    description: 'Main game lengkapi kalimat',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m, args) => {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;

        // Cek apakah ada game yang sedang berjalan
        const activeGame = hasActiveGame(from);
        if (activeGame) {
            return sock.sendMessage(from, {
                text: `❌ Masih ada game *${getGameDisplayName(activeGame)}* yang sedang berjalan!\n\n💡 Selesaikan dulu atau ketik *nyerah* untuk menyerah.`
            });
        }

        try {
            // Ambil soal dari API
            const res = await fetch("https://api.siputzx.my.id/api/games/lengkapikalimat");
            const json = await res.json();

            console.log('[LengkapiKalimat] API Response:', JSON.stringify(json).substring(0, 200));

            // API uses 'pertanyaan' field, not 'soal'
            let soal, jawaban;

            if (json?.data?.pertanyaan && json?.data?.jawaban) {
                soal = json.data.pertanyaan;
                jawaban = json.data.jawaban;
            } else if (json?.data?.soal && json?.data?.jawaban) {
                soal = json.data.soal;
                jawaban = json.data.jawaban;
            } else if (json?.pertanyaan && json?.jawaban) {
                soal = json.pertanyaan;
                jawaban = json.jawaban;
            } else if (json?.soal && json?.jawaban) {
                soal = json.soal;
                jawaban = json.jawaban;
            }

            if (!soal || !jawaban) {
                console.error('[LengkapiKalimat] Missing data:', json);
                return sock.sendMessage(from, { text: "❌ API error, data tidak tersedia.\n\nResponse: " + JSON.stringify(json).substring(0, 100) });
            }

            const baseText = `🎮 *LENGKAPI KALIMAT* 🎮\n\n${soal}`;

            // Kirim soal ke user
            const sentMsg = await sock.sendMessage(from, {
                text: `${baseText}\n\n⏱️ Waktu: 120 detik\n💡 Ketik *clue* untuk petunjuk\n💡 Ketik *nyerah* untuk menyerah.`
            });

            // Siapin storage game global
            global.lengkapiKalimat = global.lengkapiKalimat || {};

            const timers = startGameCountdown(sock, from, sentMsg.key, baseText, 120, () => {
                // auto nyerah kalo timeout
                sock.sendMessage(from, {
                    text: `⏳ Waktu habis!\n\n✅ Jawaban yang benar: *${jawaban}*`
                });
                delete global.lengkapiKalimat[from];
            });

            global.lengkapiKalimat[from] = {
                jawaban: jawaban.toLowerCase(),
                clue: generateScrambledClue(jawaban),
                clueUsed: false,
                timeout: timers.timeout,
                countdownInterval: timers.countdownInterval
            };

        } catch (err) {
            console.error("Lengkapi Kalimat Error:", err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}\n\nCoba lagi nanti.` });
        }
    }
}
