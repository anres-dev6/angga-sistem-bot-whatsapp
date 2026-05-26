import fetch from "node-fetch";

export default {
    name: 'caklontong',
    aliases: ['caklontong', 'cl'],
    tags: ['game'],
    description: 'Main game cak lontong',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m, args) => {
        const from = m.key.remoteJid;
        const sender = m.key.participant || from;

        try {
            // Ambil soal dari API
            const res = await fetch("https://api.siputzx.my.id/api/games/caklontong");
            const json = await res.json();

            const soal = json?.data?.soal;
            const jawaban = json?.data?.jawaban;

            if (!soal || !jawaban) {
                return sock.sendMessage(from, { text: "API error bro, datanya acak-acakkan." });
            }

            // Siapin storage game global
            global.cakLontong = global.cakLontong || {};
            global.cakLontong[sender] = {
                jawaban: jawaban.toLowerCase(),
                timeout: setTimeout(() => {
                    // auto nyerah kalo timeout
                    sock.sendMessage(from, {
                        text: `⏳ Waktu habis!\nJawaban yang bener: *${jawaban}*`
                    });
                    delete global.cakLontong[sender];
                }, 30000) // 30 detik
            };

            // Kirim soal ke user
            await sock.sendMessage(from, {
                text: `*CAK LONTONG*\n\n${soal}\n\n⏱️ Waktu: 30 detik\nKetik *nyerah* kalo mau nyerah.`
            });

        } catch (err) {
            console.error("Cak Lontong Error:", err);
            await sock.sendMessage(from, { text: "Error bro, server lagi rewel." });
        }
    }
}
