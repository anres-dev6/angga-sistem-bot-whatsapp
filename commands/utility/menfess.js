import { createConfessSession, cleanJid } from '../../Lib/confess_manager.js';

export default {
    name: 'menfess',
    aliases: ['menfess'],
    tags: ['tools'],
    description: 'Kirim pesan rahasia anonim interaktif (2 arah) ke nomor tujuan melalui bot',
    access: {
        owner: false,
        group: false,
        private: true
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        // Private chat requirement safeguard
        if (isGroup) {
            return sock.sendMessage(from, {
                text: "❌ Fitur Menfess hanya dapat digunakan di Private Chat (Chat Pribadi dengan Bot)."
            }, { quoted: msg });
        }

        const input = args.join(" ");

        if (!input || !input.includes('|')) {
            return sock.sendMessage(from, {
                text: "❌ Perintah tidak lengkap!\n\n💡 *Format:* \n• `.menfess (nomor) | (pesan)`\n• `.menfess (nama pengirim) | (nomor) | (pesan)`\n\n💡 *Contoh:* \n• `.menfess 089765789087 | Halo, mau ngobrol secara rahasia?`"
            }, { quoted: msg });
        }

        const parts = input.split('|');
        let senderName = "Pengagum Rahasia";
        let receiverNum = "";
        let firstMsg = "";

        if (parts.length === 2) {
            receiverNum = parts[0]?.trim();
            firstMsg = parts[1]?.trim();
        } else if (parts.length >= 3) {
            senderName = parts[0]?.trim() || "Pengagum Rahasia";
            receiverNum = parts[1]?.trim();
            firstMsg = parts.slice(2).join('|')?.trim();
        }

        if (!receiverNum || !firstMsg) {
            return sock.sendMessage(from, {
                text: "❌ Nomor tujuan dan isi pesan tidak boleh kosong!\n\n💡 *Format:* `.menfess (nomor) | (pesan)`"
            }, { quoted: msg });
        }

        try {
            const senderJid = from;
            const session = await createConfessSession(sock, senderJid, senderName, receiverNum, firstMsg);
            const cleanTarget = cleanJid(session.receiverJid);

            await sock.sendMessage(from, {
                text: `🔒 *Sesi Menfess Berhasil Dibuat!*\n\n💌 Pesan rahasia Anda telah terkirim secara anonim ke nomor *+${cleanTarget}*.\n\n📱 *Interaksi 2 Arah:* Target dapat membalas pesan Anda. Cukup ketik pesan di chat pribadi bot ini untuk saling berkirim balasan secara anonim.\n\n💡 *Tips:* Ketik *.menfessstop* atau *.confessstop* kapan saja untuk mengakhiri sesi obrolan secara manual.`
            }, { quoted: msg });

        } catch (error) {
            return sock.sendMessage(from, {
                text: `❌ Gagal membuat sesi menfess: ${error.message}`
            }, { quoted: msg });
        }
    }
};
