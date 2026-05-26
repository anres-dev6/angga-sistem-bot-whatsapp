import fetch from "node-fetch";
import { hasActiveGame, getGameDisplayName, generateScrambledClue, startGameCountdown } from "../utils/gameHelper.js";

export default {
    name: 'tebakhewan',
    aliases: ['tebakhewan', 'th'],
    tags: ['game'],
    description: 'Main game tebak hewan',
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
            // Ambil soal dari API siputzx
            const res = await fetch("https://api.siputzx.my.id/api/games/tebakhewan");
            const json = await res.json();

            console.log('[TebakHewan] API Response:', JSON.stringify(json).substring(0, 200));

            // Check different possible response structures
            let img, jawaban;

            if (json?.data?.img && json?.data?.jawaban) {
                // Structure: { data: { img, jawaban } }
                img = json.data.img;
                jawaban = json.data.jawaban;
            } else if (json?.img && json?.jawaban) {
                // Structure: { img, jawaban }
                img = json.img;
                jawaban = json.jawaban;
            } else if (json?.result?.img && json?.result?.jawaban) {
                // Structure: { result: { img, jawaban } }
                img = json.result.img;
                jawaban = json.result.jawaban;
            }

            if (!img || !jawaban) {
                console.error('[TebakHewan] Missing data:', json);
                return sock.sendMessage(from, { text: "❌ API error, data tidak tersedia.\n\nResponse: " + JSON.stringify(json).substring(0, 100) });
            }

            const baseText = `🎮 *TEBAK HEWAN* 🎮\n\n❓ Hewan apa ini?`;

            // Kirim gambar dengan caption
            const sentMsg = await sock.sendMessage(from, {
                image: { url: img },
                caption: `${baseText}\n\n⏱️ Waktu: 120 detik\n💡 Ketik *clue* untuk petunjuk\n💡 Ketik *nyerah* untuk menyerah.`
            });

            // Siapin storage game global
            global.tebakHewan = global.tebakHewan || {};

            const timers = startGameCountdown(sock, from, sentMsg.key, baseText, 120, () => {
                // auto nyerah kalo timeout
                sock.sendMessage(from, {
                    text: `⏳ Waktu habis!\n\n✅ Jawaban yang benar: *${jawaban}*`
                });
                delete global.tebakHewan[from];
            });

            global.tebakHewan[from] = {
                jawaban: jawaban.toLowerCase(),
                clue: generateScrambledClue(jawaban),
                clueUsed: false,
                timeout: timers.timeout,
                countdownInterval: timers.countdownInterval
            };

        } catch (err) {
            console.error("Tebak Hewan Error:", err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}\n\nCoba lagi nanti.` });
        }
    }
}
