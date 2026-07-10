import axios from 'axios';
import config from '../../config.js';

export default {
    name: 'resi',
    aliases: ['resi', 'cekresi', 'track'],
    tags: ['tools'],
    description: 'Cek resi pelacakan paket',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        // 1. Validasi parameter input
        if (args.length < 2 || !args[0] || !args[1]) {
            return sock.sendMessage(from, {
                text: "❌ Format Salah! Format yang benar: .resi [ekspedisi] [no_resi] Contoh: .resi jne 123456789"
            }, { quoted: msg });
        }

        // 2. Ekstraksi dan normalisasi input (ekspedisi diubah menjadi huruf kecil/toLowerCase)
        const ekspedisiInput = args[0].toLowerCase();
        const noResi = args[1].trim();

        // 3. React loading
        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        try {
            // Dapatkan keys dari config atau process.env
            const binderbyteKey = config.BINDERBYTE_API_KEY && config.BINDERBYTE_API_KEY !== 'YOUR_BINDERBYTE_API_KEY' ? config.BINDERBYTE_API_KEY : process.env.BINDERBYTE_API_KEY;
            const rajaongkirKey = config.RAJAONGKIR_API_KEY && config.RAJAONGKIR_API_KEY !== 'YOUR_RAJAONGKIR_API_KEY' ? config.RAJAONGKIR_API_KEY : process.env.RAJAONGKIR_API_KEY;

            let resultData = null;

            if (binderbyteKey) {
                console.log(`[Resi] Tracking ${noResi} via BinderByte (courier: ${ekspedisiInput})`);
                const url = `https://api.binderbyte.com/v1/track?api_key=${binderbyteKey}&courier=${ekspedisiInput}&awb=${noResi}`;
                const { data } = await axios.get(url, { timeout: 20000 });

                if (data && data.status === 200 && data.data) {
                    const res = data.data;
                    resultData = {
                        courier: (res.summary.courier || ekspedisiInput).toUpperCase(),
                        resi: res.summary.awb,
                        status: res.summary.status || '-',
                        sender: res.detail.shipper || '-',
                        origin: res.detail.origin || '-',
                        receiver: res.detail.receiver || '-',
                        destination: res.detail.destination || '-',
                        history: (res.history || []).map(h => ({
                            date: h.date,
                            desc: h.desc,
                            location: h.location || ''
                        }))
                    };
                }
            } else if (rajaongkirKey) {
                console.log(`[Resi] Tracking ${noResi} via RajaOngkir (courier: ${ekspedisiInput})`);
                const params = new URLSearchParams();
                params.append('waybill', noResi);
                params.append('courier', ekspedisiInput);

                const { data } = await axios.post('https://api.rajaongkir.com/basic/waybill', params, {
                    headers: {
                        'key': rajaongkirKey,
                        'content-type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 20000
                });

                if (data && data.rajaongkir && data.rajaongkir.status && data.rajaongkir.status.code === 200 && data.rajaongkir.result) {
                    const res = data.rajaongkir.result;
                    resultData = {
                        courier: (res.summary.courier_code || ekspedisiInput).toUpperCase(),
                        resi: res.summary.waybill_number,
                        status: res.summary.status || '-',
                        sender: res.summary.shipper_name || '-',
                        origin: res.summary.origin || '-',
                        receiver: res.summary.receiver_name || '-',
                        destination: res.summary.destination || '-',
                        history: (res.manifest || []).map(m => ({
                            date: `${m.manifest_date} ${m.manifest_time}`,
                            desc: m.manifest_description,
                            location: m.city_name || ''
                        }))
                    };
                }
            } else {
                // Jika API keys belum dikonfigurasi
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return sock.sendMessage(from, {
                    text: "⚠️ API Key BinderByte atau RajaOngkir belum dikonfigurasi di `config.js`!\n\n💡 Silakan daftarkan API Key Anda dan masukkan ke file config.js."
                }, { quoted: msg });
            }

            // Jika hasil tidak ditemukan atau format respon dari API tidak cocok
            if (!resultData) {
                throw new Error("Data pelacakan kosong atau tidak valid");
            }

            // Urutkan riwayat perjalanan paket dari yang paling baru (descending order)
            const sortedHistory = [...resultData.history].sort((a, b) => {
                return new Date(b.date.replace(/-/g, '/')) - new Date(a.date.replace(/-/g, '/'));
            });

            // Batasi riwayat pelacakan hanya tiga status terbaru supaya pesan tetap ringkas
            const limitedHistory = sortedHistory.slice(0, 3);

            let historyText = '';
            if (limitedHistory.length > 0) {
                historyText = limitedHistory.map((h, i) => {
                    const loc = h.location ? ` - ${h.location}` : '';
                    return `${i + 1}. *[${h.date}]* ${h.desc}${loc}`;
                }).join('\n');
            } else {
                historyText = '• Tidak ada riwayat perjalanan terdeteksi.';
            }

            // Format output chat yang rapi, bersih, dan mudah dibaca
            const trackingMessage = `📦 *HASIL PELACAKAN RESI* 📦
━━━━━━━━━━━━━━━━━━

ℹ️ *Informasi Ekspedisi*
• *Ekspedisi:* ${resultData.courier}
• *Nomor Resi:* ${resultData.resi}
• *Status Terbaru:* ${resultData.status}

👤 *Data Pengirim*
• *Pengirim:* ${resultData.sender}
• *Kota Asal:* ${resultData.origin}

👥 *Data Penerima*
• *Penerima:* ${resultData.receiver}
• *Kota Tujuan:* ${resultData.destination}

🕒 *Riwayat Perjalanan (3 Terbaru)*
${historyText}

━━━━━━━━━━━━━━━━━━`;

            // React success
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});

            // Kirim pesan pelacakan
            await sock.sendMessage(from, { text: trackingMessage }, { quoted: msg });

        } catch (error) {
            console.error('[Resi] Error tracking package:', error);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            
            // Pesan kesalahan yang jelas jika resi tidak ditemukan, ekspedisi tidak didukung, atau API gangguan
            return sock.sendMessage(from, {
                text: "❌ Resi tidak ditemukan atau ekspedisi tidak didukung. Silakan periksa kembali."
            }, { quoted: msg });
        }
    }
};
