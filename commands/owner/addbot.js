import { addUserbot } from '../../Lib/userbot_manager.js';

export default {
    name: 'addbot',
    aliases: ['addbot'],
    tags: ['owner'],
    description: 'Hubungkan nomor baru menjadi userbot mandiri menggunakan Pairing Code',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args, { text, sender }) => {
        const from = msg.key.remoteJid;

        if (args.length === 0) {
            return sock.sendMessage(from, {
                text: '❌ *Nomor telepon diperlukan!*\n\n' +
                      '📝 *Cara pakai:*\n' +
                      '`.addbot <nomor> /<fitur>/<fitur>`\n\n' +
                      '💡 *Contoh:*\n' +
                      '`.addbot +6289972839173 /gl`'
            }, { quoted: msg });
        }

        const phoneNumber = args[0];
        const cleanedNumber = phoneNumber.replace(/\D/g, '');

        if (cleanedNumber.length < 10) {
            return sock.sendMessage(from, { text: '❌ Nomor telepon tidak valid.' }, { quoted: msg });
        }

        // Parse features
        const textAfterNum = text.replace(phoneNumber, '').trim();
        const features = textAfterNum.split('/').map(f => f.trim().toLowerCase()).filter(f => f);

        const loading = await sock.sendMessage(from, {
            text: `⏳ *Menginisialisasi sesi baru untuk +${cleanedNumber}...*`
        }, { quoted: msg });

        try {
            const result = await addUserbot(cleanedNumber, features, sender, sock);

            if (result.pairingCode) {
                // Return pairing code
                await sock.sendMessage(from, {
                    text: `🔑 *PAIRING CODE GENERATED*\n\n` +
                          `Nomor: +${cleanedNumber}\n` +
                          `Code: *${result.pairingCode}*\n\n` +
                          `💡 *Cara menghubungkan:*\n` +
                          `1. Buka WhatsApp > Linked Devices\n` +
                          `2. Klik 'Link a Device'\n` +
                          `3. Pilih 'Link with phone number instead'\n` +
                          `4. Masukkan kode di atas.`
                }, { quoted: msg });

                await sock.sendMessage(from, { delete: loading.key });
            } else if (result.success) {
                // If already connected
                await sock.sendMessage(from, {
                    text: `BOT CONNECTED\n` +
                          `Nomor: +${cleanedNumber}\n` +
                          `Fitur: ${features.join(', ') || 'tidak ada'}\n\n` +
                          `Aturan:\n` +
                          `- tidak otomatis mendapat semua fitur\n` +
                          `- session terpisah\n` +
                          `- reconnect otomatis\n` +
                          `- support multi userbot`
                }, { quoted: msg });

                await sock.sendMessage(from, { delete: loading.key });
            }

        } catch (error) {
            console.error('[AddBot] Error:', error);
            await sock.sendMessage(from, {
                text: `❌ *Gagal menambahkan bot!*\n\n⚠️ ${error.message || 'Error tidak diketahui'}`
            }, { quoted: msg });
            await sock.sendMessage(from, { delete: loading.key });
        }
    }
};
