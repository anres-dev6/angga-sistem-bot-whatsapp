import axios from "axios";
import { imageToWebp } from "../../Lib/converter.js";
import { addStickerMetadata } from "../../Lib/sticker.js";

export default {
    name: 'brat',
    aliases: ['brat', 'b'],
    tags: ['sticker'],
    description: 'Buat stiker teks brat dengan metadata custom',
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

            // Convert raw PNG/JPG image to WebP sticker format
            const webpBuffer = await imageToWebp(buffer);

            // Inject custom WhatsApp sticker EXIF metadata
            const finalSticker = await addStickerMetadata(webpBuffer, 'ANRES-DEV6', 'Made With ANRES');

            // Kirim stiker hasil modifikasi
            await sock.sendMessage(from, {
                sticker: finalSticker
            }, { quoted: m });

        } catch (err) {
            console.log("Brat Error:", err);
            await sock.sendMessage(m.key.remoteJid, { text: "Gagal generate stiker brat bos." });
        }
    }
}
