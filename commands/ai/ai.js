import fetch from 'node-fetch';

if (!global.aiAutoResponse) {
    global.aiAutoResponse = {};
}

export default {
    name: 'ai',
    aliases: ['ai', 'chat', 'gpt'],
    tags: ['tools'],
    description: 'Chat dengan AI',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        const userPrompt = args.join(" ");
        if (!userPrompt) {
            return sock.sendMessage(from, {
                text: "🤖 *Antigravity AI*\n\nPakai:\n.ai <pertanyaan>\n.chat <pertanyaan>\n.gpt <pertanyaan>"
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        try {
            // Try multiple free AI APIs for reliability
            let aiText = null;
            let error = null;

            // API 1: Widipe (GPT-4)
            try {
                const res = await fetch(`https://widipe.com/gpt4?text=${encodeURIComponent(userPrompt)}`, {
                    method: "GET",
                    timeout: 30000
                });

                if (res.ok) {
                    const json = await res.json();
                    aiText = json.result || json.data || json.response;
                }
            } catch (err) {
                console.log('[AI] API 1 failed:', err.message);
            }

            // API 2: Ryzendesu (Gemini)
            if (!aiText) {
                try {
                    const res = await fetch(`https://api.ryzendesu.vip/api/ai/chatgpt?text=${encodeURIComponent(userPrompt)}`, {
                        method: "GET",
                        timeout: 30000
                    });

                    if (res.ok) {
                        const json = await res.json();
                        aiText = json.response || json.result || json.data;
                    }
                } catch (err) {
                    console.log('[AI] API 2 failed:', err.message);
                }
            }

            // API 3: Aemt (GPT)
            if (!aiText) {
                try {
                    const res = await fetch(`https://aemt.me/gpt4?text=${encodeURIComponent(userPrompt)}`, {
                        method: "GET",
                        timeout: 30000
                    });

                    if (res.ok) {
                        const json = await res.json();
                        aiText = json.result || json.data || json.response;
                    }
                } catch (err) {
                    console.log('[AI] API 3 failed:', err.message);
                    error = err;
                }
            }

            if (!aiText) {
                throw new Error("Semua AI API sedang down. Coba lagi nanti.");
            }

            await sock.sendMessage(from, { text: aiText.trim() }, { quoted: msg });
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("[AI] Error:", err.message);

            await sock.sendMessage(from, {
                text: "❌ *AI Error*\n\n" + err.message + "\n\n💡 Coba lagi dalam beberapa saat."
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
        }
    }
};