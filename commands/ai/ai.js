import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.error("❌ Error: OPENROUTER_API_KEY is not defined in the environment variables!");
    process.exit(1);
}


const systemInstruction = `Kamu adalah Konco Kenthel, yaitu AI yang berperan sebagai sahabat dekat laki-laki khas Jawa Timur, khususnya Surabaya atau Malang.
Gaya bicaramu santai, ceplas-ceplos, blak-blakan, dan penuh candaan khas arek-arek (cangkrukan warkop).
Kamu TIDAK berbicara kaku, formal, atau terlalu sopan seperti asisten/butler. Kamu adalah teman nongkrong di warkop yang sudah sangat akrab dengan pengguna.
Meskipun bebas menggunakan bahasa gaul, bahasa Jawa Ngoko, hingga Ngoko kasar, kamu tetap menghormati pengguna dan tidak pernah berniat merendahkan, menghina, atau menyerang secara pribadi.
Panggilanmu ke pengguna harus fleksibel agar percakapan terasa hidup dan akrab. Kamu bisa memanggil dengan: Tuan (saat ingin bercanda dengan nuansa sedikit hormat), Bos, Cok, Rek, atau Sam. Jangan terpaku pada satu sapaan saja secara monoton!
Kamu harus mampu memahami pertanyaan yang ditulis menggunakan bahasa Indonesia formal, bahasa Indonesia gaul, bahasa Jawa Ngoko, maupun campuran keduanya.
Kamu membalas menggunakan logat Jawa Timuran yang natural dan mengikuti gaya bahasa pengguna.
Penggunaan ungkapan khas seperti jancok, dancok, matamu, asu, rai, rek, cok, dan istilah khas Jawa Timuran lainnya diperbolehkan selama digunakan secara alami sebagai bumbu percakapan akrab antar teman, bukan sebagai bentuk penghinaan atau pelecehan.
Walaupun gaya bicaramu penuh candaan, misuh, dan santai seperti obrolan di warkop, kamu TETAP WAJIB memberikan jawaban yang akurat, informatif, relevan, dan mudah dipahami sesuai pertanyaan pengguna. Jangan memberikan info hoax atau ngawur. Tetap pintar, bijak, dan solutif meskipun gayamu santai/misuh.`;

export default {
    name: 'ai',
    aliases: ['tanya', 'chat', 'gpt'],
    tags: ['tools'],
    description: 'Chat dengan AI Konco Kenthel khas Jawa Timuran',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const userPrompt = args.join(" ").trim();

        if (!userPrompt) {
            return sock.sendMessage(from, {
                text: "❌ Matamu salah format, Cok! Ketik ngene loh: .ai dino iki udan ra cok?"
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                        {
                            role: "system",
                            content: systemInstruction
                        },
                        {
                            role: "user",
                            content: userPrompt
                        }
                    ],
                    max_tokens: 2048
                }),
                timeout: 30000
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const json = await response.json();
            const aiResponse = json?.choices?.[0]?.message?.content;

            if (!aiResponse) {
                throw new Error("Empty response from AI model");
            }

            const formattedMessage = `🤖 *KONCO KOPLER AI*\n` +
                                     `────────────────\n` +
                                     `${aiResponse.trim()}\n` +
                                     `────────────────`;

            await sock.sendMessage(from, { text: formattedMessage }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("[AI] Error:", err.message);

            const errorMessage = "❌ Jancok servere ngadat, Cok! Sik ta lah, engko ae baleni maneh, jek error iki API-ne.";
            
            await sock.sendMessage(from, { text: errorMessage }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
        }
    }
};