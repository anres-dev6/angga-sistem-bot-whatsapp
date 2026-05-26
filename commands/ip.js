import axios from "axios";

// Helper function for retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 5000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            const isLastRetry = i === maxRetries - 1;

            if (isLastRetry) {
                throw error;
            }

            // Exponential backoff: 5s, 10s, 20s
            const delay = baseDelay * Math.pow(2, i);
            console.log(`[IP] Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export default {
    name: 'ip',
    aliases: ['ip', 'iphone'],
    tags: ['tools'],
    description: 'Generate iPhone-style quoted message image',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        try {
            // React loading
            await sock.sendMessage(from, {
                react: { text: '⏳', key: msg.key }
            });

            // Get message text
            const messageText = args.join(" ");

            if (!messageText || messageText.trim() === "") {
                await sock.sendMessage(from, {
                    react: { text: '❌', key: msg.key }
                });
                return sock.sendMessage(from, {
                    text: "❌ Teks tidak boleh kosong!\n\n💡 Contoh: .ip halo dunia"
                }, { quoted: msg });
            }

            // Get current time
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const time = `${hours}:${minutes}`;

            console.log('[IP] Generating image for:', messageText);

            // Retry API call with backoff
            const response = await retryWithBackoff(async () => {
                // Build API URL with all parameters
                const params = new URLSearchParams({
                    time: time,
                    messageText: messageText,
                    carrierName: 'Wi-Fi',
                    batteryPercentage: '100',
                    signalStrength: '4',
                    emojiStyle: 'apple',
                    _cache: Date.now().toString() // Prevent caching
                });

                const apiUrl = `https://brat.siputzx.my.id/iphone-quoted?${params.toString()}`;

                console.log('[IP] Calling API (attempt):', apiUrl);

                // Fetch image
                const res = await axios.get(apiUrl, {
                    responseType: 'arraybuffer',
                    timeout: 40000, // Increased to 40s
                    headers: {
                        'User-Agent': 'WhatsApp-Bot/1.0'
                    }
                });

                console.log('[IP] Response status:', res.status);
                console.log('[IP] Content-Type:', res.headers['content-type']);
                console.log('[IP] Content-Length:', res.data.length);

                // Validate response
                if (!res.data || res.data.length === 0) {
                    throw new Error('Empty response from API');
                }

                return res;
            });

            // React success
            await sock.sendMessage(from, {
                react: { text: '✅', key: msg.key }
            });

            // Send image
            await sock.sendMessage(from, {
                image: Buffer.from(response.data),
                caption: `📱 iPhone Style\n⏰ ${time}`
            }, { quoted: msg });

        } catch (error) {
            console.error('[IP] Error:', error.message);

            // React error
            await sock.sendMessage(from, {
                react: { text: '❌', key: msg.key }
            }).catch(() => { });

            // Send error message
            let errorMsg = '❌ Gagal generate gambar!\n\n';

            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorMsg += '⏱️ Request timeout setelah 40 detik.\n';
                errorMsg += '🔄 Sudah dicoba 3x dengan delay lebih lama.\n';
                errorMsg += '⚠️ API server mungkin sedang down.\n';
                errorMsg += '⏰ Coba lagi nanti ya bos.';
            } else if (error.response?.status === 500) {
                errorMsg += '⚠️ API server error (500).\n';
                errorMsg += '🔄 Sudah dicoba 3x tapi tetap gagal.\n';
                errorMsg += '⏰ Tunggu beberapa saat lalu coba lagi.';
            } else if (error.response) {
                errorMsg += `📝 API Error: ${error.response.status}\n`;
                errorMsg += '🔄 Coba lagi dalam beberapa menit.';
            } else if (error.request) {
                errorMsg += '🌐 Tidak bisa connect ke API.\n';
                errorMsg += '📡 Periksa koneksi internet.';
            } else if (error.message.includes('Empty response')) {
                errorMsg += '📭 API mengembalikan response kosong.\n';
                errorMsg += '🔄 Coba lagi: .ip teks kamu';
            } else {
                errorMsg += `📝 ${error.message}\n`;
                errorMsg += '💡 Coba lagi: .ip teks kamu';
            }

            await sock.sendMessage(from, {
                text: errorMsg
            }, { quoted: msg });
        }
    }
};
