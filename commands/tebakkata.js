import fetch from "node-fetch";
import { hasActiveGame, getGameDisplayName, generateScrambledClue, startGameCountdown } from "../utils/gameHelper.js";

export default {
    name: 'tebakkata',
    aliases: ['tebakkata', 'tk'],
    tags: ['game'],
    description: 'Main game tebak kata',
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
            const res = await fetch("https://api.siputzx.my.id/api/games/tebakkata");
            const json = await res.json();

            const soal = json?.data?.soal;
            const jawaban = json?.data?.jawaban;

            if (!soal || !jawaban) {
                return sock.sendMessage(from, { text: "❌ API error, data tidak tersedia." });
            }

            const baseText = `🎮 *TEBAK KATA* 🎮\n\n${soal}`;

            // Kirim soal ke user
            const sentMsg = await sock.sendMessage(from, {
                text: `${baseText}\n\n⏱️ Waktu: 120 detik\n💡 Ketik *clue* untuk petunjuk\n💡 Ketik *nyerah* untuk menyerah.`
            });

            // Siapin storage game global
            global.tebakKata = global.tebakKata || {};

            const timers = startGameCountdown(sock, from, sentMsg.key, baseText, 120, () => {
                // auto nyerah kalo timeout
                sock.sendMessage(from, {
                    text: `⏳ Waktu habis!\n\n✅ Jawaban yang benar: *${jawaban}*`
                });
                delete global.tebakKata[from];
            });

            global.tebakKata[from] = {
                jawaban: jawaban.toLowerCase(),
                clue: generateScrambledClue(jawaban),
                clueUsed: false,
                timeout: timers.timeout,
                countdownInterval: timers.countdownInterval
            };

        } catch (err) {
            console.error("Tebak Kata Error:", err);
            await sock.sendMessage(from, { text: "❌ Error, server sedang bermasalah." });
        }
    }
}
