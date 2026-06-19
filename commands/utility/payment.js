import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const qrisPath = path.join(__dirname, '../../data/qris.png');

export default {
    name: 'payment',
    aliases: ['payment', 'pay', 'qris', 'bayar'],
    tags: ['tools'],
    description: 'Menampilkan informasi pembayaran dan scan QRIS',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            // Check if QRIS image exists, with fallback for trashed files
            let finalQrisPath = qrisPath;
            if (!fs.existsSync(finalQrisPath)) {
                const dataDir = path.dirname(qrisPath);
                if (fs.existsSync(dataDir)) {
                    const files = fs.readdirSync(dataDir);
                    const matchingFile = files.find(file => file.toLowerCase().endsWith('qris.png'));
                    if (matchingFile) {
                        finalQrisPath = path.join(dataDir, matchingFile);
                    }
                }
            }

            if (!fs.existsSync(finalQrisPath)) {
                return sock.sendMessage(from, {
                    text: "❌ File gambar QRIS tidak ditemukan di server! Silakan hubungi owner untuk mengonfigurasinya."
                }, { quoted: msg });
            }

            // Send processing reaction
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // Read image buffer
            const qrisBuffer = fs.readFileSync(finalQrisPath);

            // Construct payment caption
            const captionText = `❏ *PAYMENT INFO*

╭─────────────
│ 💳 *QRIS*
│ 💙 *Dana*
│ 🟢 *GoPay*
│ 🛒 *ShopeePay*
╰─────────────

📱 *Nomor Pembayaran:*
085708950373

📌 *Scan QRIS atau transfer ke nomor di atas.*

Terima kasih 🙏`;

            // Send image with payment info as caption
            await sock.sendMessage(from, {
                image: qrisBuffer,
                caption: captionText
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[Payment Command] Error:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(from, {
                text: `❌ Gagal memproses info pembayaran: ${error.message}`
            }, { quoted: msg });
        }
    }
};
