import axios from "axios";

export default {
    name: 'brat',
    aliases: ['brat', 'b'],
    tags: ['sticker'],
    description: 'Buat stiker teks brat',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m, args) => {
        try {
            const from = m.key.remoteJid;
            const text = args.join(" ");

            if (!text) {
                await sock.sendMessage(from, { text: "Tulis teksnya bos, contoh:\n.brat halo dunia" });
                return;
            }

            // Request gambar dari API brat
            const url = `https://brat.siputzx.my.id/image?text=${encodeURIComponent(text)}`;

            const response = await axios.get(url, { responseType: "arraybuffer" });
            const buffer = Buffer.from(response.data);

            // Kirim sebagai stiker langsung (tanpa metadata dulu untuk testing)
            await sock.sendMessage(from, {
                sticker: buffer
            });

        } catch (err) {
            console.log("Brat Error:", err);
            await sock.sendMessage(m.key.remoteJid, { text: "Gagal generate stiker brat bos." });
        }
    }
}
