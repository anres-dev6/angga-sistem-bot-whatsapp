import fetch from 'node-fetch';

export default {
    name: 'kecocokannama',
    aliases: ['kecocokannama', 'cocok', 'jodoh'],
    tags: ['primbon'],
    description: 'Cek kecocokan nama pasangan',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        // Validasi input
        if (!args[0] || !args[1]) {
            return sock.sendMessage(from, {
                text: "❌ Format salah!\n\nPenggunaan:\n.kecocokannama [nama1] [nama2]\n\nContoh:\n.kecocokannama Putu Keyla"
            }, { quoted: msg });
        }

        const nama1 = args[0];
        const nama2 = args[1];

        try {
            // Send loading message
            await sock.sendMessage(from, { text: "🔮 Mengecek kecocokan nama..." }, { quoted: msg });

            // Call API
            const apiUrl = `https://api.siputzx.my.id/api/primbon/kecocokan_nama_pasangan?nama1=${encodeURIComponent(nama1)}&nama2=${encodeURIComponent(nama2)}`;

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
┃ *KECOCOKAN NAMA PASANGAN* ┃
╰━━━━━━━━━━━━━━━━━━╯

👤 *Nama:* ${result.nama_anda}
💑 *Nama Pasangan:* ${result.nama_pasangan}

✨ *Sisi Positif:*
${result.sisi_positif}

⚠️ *Sisi Negatif:*
${result.sisi_negatif}

📝 *Catatan:*
${result.catatan}`;

            // Send result with image
            if (result.gambar) {
                await sock.sendMessage(from, {
                    image: { url: result.gambar },
                    caption: message
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: message }, { quoted: msg });
            }

        } catch (error) {
            console.error('Kecocokan Nama Error:', error);
            await sock.sendMessage(from, {
                text: `❌ Error: ${error.message}\n\nSilakan coba lagi nanti.`
            }, { quoted: msg });
        }
    }
}
