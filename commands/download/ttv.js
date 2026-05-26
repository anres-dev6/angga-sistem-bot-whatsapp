import axios from 'axios';
import config from '../../config.js';

// Voices mapped to Gemini Prebuilt Voices
// Available: Puck, Charon, Kore, Fenrir, Aoede
const voices = [
    { name: "Aruna", id: "Aoede", desc: "suara cewek muda, bocor dikit, vibe tiktok storyteller." },
    { name: "Raka", id: "Puck", desc: "cowok santai, agak serak, cocok buat jokes receh." },
    { name: "Mega", id: "Kore", desc: "cewek formal, cocok buat pengumuman/notice." },
    { name: "Bayu", id: "Charon", desc: "cowok deep voice, mirip penyiar radio tapi bukan artis." },
    { name: "Sela", id: "Fenrir", desc: "cewek gen Z, tone nge-pop, ala-ala podcaster." }, // Fenrir is actually deeper/male usually, but let's map best effort.
    { name: "Guntur", id: "Puck", desc: "cowok tegas, style MC acara kampus." }, // Reuse Puck
    { name: "Riri", id: "Aoede", desc: "cewek imut, semi-anime tapi tetap Indonesia." }, // Reuse Aoede
    { name: "Bara", id: "Fenrir", desc: "cowok anak band, tone agak berat & mellow." }, // Reuse Fenrir
    { name: "Dewi", id: "Kore", desc: "ibu-ibu lembut, cocok buat voice reminder." }, // Reuse Kore
    { name: "Dimas", id: "Charon", desc: "cowok biasa ala abang-abang, natural." } // Reuse Charon
];

export default {
    name: 'ttv',
    aliases: ['tts', 'voice'],
    tags: ['tools'],
    description: 'Text to Voice menggunakan Gemini',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m, args) => {
        const from = m.key.remoteJid;

        // Display List if arguments are invalid
        if (args.length < 2) {
            let text = "*🎤 DAFTAR SUARA TTV (GEMINI) 🎤*\n\n";
            text += "Cara pakai: `.ttv [nomor] [teks]`\n";
            text += "Contoh: `.ttv 4 Halo selamat pagi`\n\n";

            voices.forEach((v, i) => {
                text += `${i + 1}. *${v.name}* – ${v.desc}\n`;
            });

            return sock.sendMessage(from, { text });
        }

        // Validate index
        const index = parseInt(args[0]) - 1;
        if (isNaN(index) || index < 0 || index >= voices.length) {
            return sock.sendMessage(from, { text: "Nomor suara tidak valid bos! Cek menu `.ttv` dulu." });
        }

        const voice = voices[index];
        const textToSpeech = args.slice(1).join(" ");

        if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
            return sock.sendMessage(from, { text: "API Key Gemini belum disetting di config.js bos!" });
        }

        try {
            await sock.sendMessage(from, { react: { text: "🎙️", key: m.key } });

            // Use Gemini 2.0 Flash Exp which supports Audio Generation
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`;

            const payload = {
                contents: [{
                    parts: [{ text: textToSpeech }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voice.id
                            }
                        }
                    }
                }
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': config.GEMINI_API_KEY
                }
            });

            // Response is already parsed by axios
            const responseData = response.data;

            // Extract audio from Gemini response structure
            if (!responseData.candidates ||
                !responseData.candidates[0]?.content?.parts?.[0]?.inlineData?.data) {
                console.error('Full response:', JSON.stringify(responseData, null, 2));
                throw new Error("No audio content in response");
            }

            const audioBase64 = responseData.candidates[0].content.parts[0].inlineData.data;
            const audioBuffer = Buffer.from(audioBase64, 'base64');

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mp4',
                ptt: true // Send as voice note
            }, { quoted: m });

            await sock.sendMessage(from, { react: { text: "✅", key: m.key } });

        } catch (err) {
            console.error("TTV Error Details:", err.message);

            let errorMessage = "Gagal bikin audio bos.";

            if (err.response) {
                // API responded with an error code (4xx, 5xx)
                console.error("API Response Status:", err.response.status);
                console.error("API Response Data:", JSON.stringify(err.response.data, null, 2));
                const status = err.response.status;

                if (status === 404) {
                    errorMessage += " (Error 404: Model/Endpoint tidak ditemukan. Cek kode bot)";
                } else if (status === 401 || status === 403) {
                    errorMessage += " (Error Auth: API Key salah atau limit habis)";
                } else if (status === 429) {
                    errorMessage += " (Error 429: Too Many Requests. Tunggu sebentar bos, limit API habis!)";
                } else if (status === 400) {
                    errorMessage += " (Error 400: Request salah. Cek payload)";
                } else {
                    errorMessage += ` (Error ${status})`;
                }
            } else {
                // Network error or code error
                errorMessage += ` (${err.message})`;
            }

            await sock.sendMessage(from, { text: errorMessage });
            await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
        }
    }
};
