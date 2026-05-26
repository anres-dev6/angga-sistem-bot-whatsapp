import fetch from "node-fetch";
import { hasActiveGame, getGameDisplayName, startGameCountdown } from "../utils/gameHelper.js";

export default {
    name: 'tebakgambar',
    aliases: ['tebakgambar', 'tg'],
    tags: ['game'],
    description: 'Main game tebak gambar',
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
            const res = await fetch("https://api.siputzx.my.id/api/games/tebakgambar");
            const json = await res.json();

            const img = json?.data?.img;
            const jawaban = json?.data?.jawaban;
            const deskripsi = json?.data?.deskripsi;

            if (!img || !jawaban) {
                return sock.sendMessage(from, { text: "❌ API error, data tidak tersedia." });
            }

            const baseText = `🎮 *TEBAK GAMBAR* 🎮\n\n❓ Apa maksud gambar ini?`;

            // Kirim gambar dengan caption
            const sentMsg = await sock.sendMessage(from, {
                image: { url: img },
                caption: `${baseText}\n\n⏱️ Waktu: 120 detik\n💡 Ketik *clue* untuk petunjuk\n💡 Ketik *nyerah* untuk menyerah.`
            });

            // Siapin storage game global
            global.tebakGambar = global.tebakGambar || {};

            const timers = startGameCountdown(sock, from, sentMsg.key, baseText, 120, () => {
                // auto nyerah kalo timeout
                sock.sendMessage(from, {
                    text: `⏳ Waktu habis!\n\n✅ Jawaban yang benar: *${jawaban}*`
                });
                delete global.tebakGambar[from];
            });

            global.tebakGambar[from] = {
                jawaban: jawaban.toLowerCase(),
                clue: deskripsi || "Perhatikan gambar dengan teliti!",
                clueUsed: false,
                timeout: timers.timeout,
                countdownInterval: timers.countdownInterval
            };

        } catch (err) {
            console.error("Tebak Gambar Error:", err);
            await sock.sendMessage(from, { text: "❌ Error, server sedang bermasalah." });
        }
    }
}
