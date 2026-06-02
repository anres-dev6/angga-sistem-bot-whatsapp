import fetch from 'node-fetch';

export default {
    name: 'artinama',
    aliases: ['artinama', 'arti'],
    tags: ['primbon'],
    description: 'Cari arti nama',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        // Validasi input
        if (!args[0]) {
            return sock.sendMessage(from, {
                text: "❌ Format salah!\n\nPenggunaan:\n.artinama [nama]\n\nContoh:\n.artinama Putu"
            }, { quoted: msg });
        }

        const nama = args.join(" ");

        try {
            // Send loading message
            await sock.sendMessage(from, { text: "🔮 Mencari arti nama..." }, { quoted: msg });

            // Call API
            const apiUrl = `https://api.siputzx.my.id/api/primbon/artinama?nama=${encodeURIComponent(nama)}`;

            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.status) {
                throw new Error("Data tidak ditemukan");
            }

            const result = data.data;

            // Format response message
            const message = `╭━━━━━━━━━━━━━━━━━━╮
┃ *ARTI NAMA* ┃
╰━━━━━━━━━━━━━━━━━━╯

👤 *Nama:* ${result.nama}

📖 *Arti & Kepribadian:*
${result.arti}

📝 *Catatan:*
${result.catatan}`;

            await sock.sendMessage(from, { text: message }, { quoted: msg });

        } catch (error) {
            console.error('Arti Nama Error:', error);
            await sock.sendMessage(from, {
                text: `❌ Error: ${error.message}\n\nSilakan coba lagi nanti.`
            }, { quoted: msg });
        }
    }
}
