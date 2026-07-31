import { createConfessSession } from '../../Lib/confess_manager.js';

export default {
    name: 'confess',
    aliases: ['confess', 'menfess'],
    tags: ['tools'],
    description: 'Kirim pesan rahasia anonim ke nomor tujuan melalui bot',
    access: {
        owner: false,
        group: false,
        private: false
    },
    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const input = args.join(" ");

        if (!input || !input.includes('|')) {
            return sock.sendMessage(from, {
                text: "❌ Perintah tidak lengkap!\n\n💡 *Format:* \n• `.confess Nama Pengirim|Nomor Tujuan|Isi Pesan`\n\n💡 *Contoh:* \n• `.confess Bos|089765789087|Halo, semoga harimu menyenangkan.`"
            }, { quoted: msg });
        }

        const parts = input.split('|');
        if (parts.length < 3) {
            return sock.sendMessage(from, {
                text: "❌ Format salah! Pastikan menggunakan pembatas karakter vertikal (|) sebanyak dua kali untuk memisahkan Nama, Nomor, dan Pesan.\n\n💡 *Format:* `.confess Nama|Nomor|Pesan`"
            }, { quoted: msg });
        }

        const senderName = parts[0]?.trim();
        const receiverNum = parts[1]?.trim();
        const firstMsg = parts.slice(2).join('|')?.trim(); // Handles any accidental | inside the message itself

        if (!senderName || !receiverNum || !firstMsg) {
            return sock.sendMessage(from, {
                text: "❌ Nama pengirim, nomor tujuan, dan pesan tidak boleh kosong!"
            }, { quoted: msg });
        }

        try {
            // Determine real sender JID
            const isGroup = from.endsWith('@g.us');
            const senderJid = isGroup ? (msg.key.participant || msg.participant || from) : from;

            // Initiate the session
            await createConfessSession(sock, senderJid, senderName, receiverNum, firstMsg);

            // Confirm successful session startup to the sender
            await sock.sendMessage(from, {
                text: `🔒 *Sesi Confess berhasil dibuat!*\n\n💌 Pesan rahasia Anda telah terkirim secara anonim ke nomor tujuan.\n\n📱 *Lanjutkan Percakapan:* Silakan gunakan *Private Chat (Chat Pribadi dengan Bot)* untuk saling berkirim pesan/balasan secara anonim.\n\n💡 *Tips:* Ketik *.confessstop* kapan saja untuk mengakhiri sesi obrolan secara manual.`
            }, { quoted: msg });

        } catch (error) {
            return sock.sendMessage(from, {
                text: `❌ Gagal membuat sesi confess: ${error.message}`
            }, { quoted: msg });
        }
    }
};
