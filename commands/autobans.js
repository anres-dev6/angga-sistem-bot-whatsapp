import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage } from 'baileys';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bannedStickersPath = path.join(__dirname, '../Lib/banned_stickers.json');
const autobansConfigPath = path.join(__dirname, '../Lib/autobans_config.json');

// Helper to Load/Save banned sticker keywords
function loadBannedKeywords() {
    try {
        if (!fs.existsSync(bannedStickersPath)) {
            // Default banned keywords
            const defaults = [
                'nsfw', 'porn', 'telanjang', 'bugil', 'nude',
                'sex', 'vulgar', 'kekerasan', 'violence', 'gore',
                'hate', 'racism', 'sara', 'hoax', 'penipuan', 'gay',
                'orang kulit hitam', 'jorok', 'pembunuhan', 'darah'
            ];
            saveBannedKeywords(defaults);
            return defaults;
        }
        return JSON.parse(fs.readFileSync(bannedStickersPath));
    } catch (e) {
        console.error('Error loading banned keywords:', e);
        return [];
    }
}

function saveBannedKeywords(data) {
    const dir = path.dirname(bannedStickersPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(bannedStickersPath, JSON.stringify(data, null, 2));
}

// Helper to Load/Save autobans config (per group)
// When enabled, ALL stickers will be automatically deleted
function loadAutobansConfig() {
    try {
        if (!fs.existsSync(autobansConfigPath)) {
            return {};
        }
        return JSON.parse(fs.readFileSync(autobansConfigPath));
    } catch (e) {
        console.error('Error loading autobans config:', e);
        return {};
    }
}

function saveAutobansConfig(data) {
    const dir = path.dirname(autobansConfigPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(autobansConfigPath, JSON.stringify(data, null, 2));
}

function isAutobansEnabled(groupId) {
    const config = loadAutobansConfig();
    return config[groupId] === true;
}

function setAutobansStatus(groupId, status) {
    const config = loadAutobansConfig();
    config[groupId] = status;
    saveAutobansConfig(config);
}

// Analyze sticker using AI
async function analyzeStickerWithAI(imageBuffer) {
    try {
        // Convert buffer to base64
        const base64Image = imageBuffer.toString('base64');

        // Call Gemini Vision API
        const apiKey = config.GEMINI_API_KEY;

        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            console.error('[AutoBan] GEMINI_API_KEY not configured!');
            console.error('[AutoBan] Please edit config.js and add your Gemini API key');
            return { isInappropriate: false, reason: 'API key not configured' };
        }

        console.log('[AutoBan] Sending sticker to AI for analysis...');

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            text: "Analyze this sticker image carefully. Check if it contains ANY of the following:\n1. NSFW/sexual content (nudity, pornography, sexual acts)\n2. Violence or gore (blood, weapons, death, injury)\n3. Hateful content (racism, discrimination, offensive symbols)\n4. Inappropriate emojis or symbols (middle finger, sexual gestures, vulgar signs)\n5. Black or dark shapes that could be inappropriate silhouettes or offensive imagery\n6. Weird or suspicious shapes that could represent inappropriate content\n7. Any disturbing, shocking, or offensive imagery\n\nAnswer with ONLY 'UNSAFE' if ANY of the above are detected, or 'SAFE' if the sticker is appropriate. Follow with a brief reason."
                        },
                        {
                            inline_data: {
                                mime_type: "image/webp",
                                data: base64Image
                            }
                        }
                    ]
                }],
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AutoBan] API Error:', response.status, errorText);
            return { isInappropriate: false, reason: 'API request failed' };
        }

        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('[AutoBan] AI Response:', aiResponse);

        // Check if AI says it's unsafe
        const responseUpper = aiResponse.toUpperCase();
        if (responseUpper.includes('UNSAFE')) {
            return {
                isInappropriate: true,
                reason: aiResponse
            };
        }

        // Additional checks for blocked content
        if (data.candidates?.[0]?.finishReason === 'SAFETY') {
            console.log('[AutoBan] Content blocked by safety filters - marking as inappropriate');
            return {
                isInappropriate: true,
                reason: 'Content blocked by safety filters (likely inappropriate)'
            };
        }

        return { isInappropriate: false, reason: 'Content appears safe' };

    } catch (error) {
        console.error('[AutoBan] AI Analysis error:', error.message);
        console.error('[AutoBan] Full error:', error);
        return { isInappropriate: false, reason: 'Analysis failed: ' + error.message };
    }
}

export default {
    name: 'autobans',
    aliases: ['addbansticker', 'delbansticker', 'listbansticker'],
    tags: ['admin'],
    hidden: true,
    access: {
        owner: false,
        group: true,
        private: false
    },

    run: async (sock, m, args, { command, isOwner }) => {
        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (!isGroup) {
            return sock.sendMessage(from, { text: '❌ Fitur ini hanya untuk grup!' }, { quoted: m });
        }

        // Check permissions (Owner or Group Admin)
        if (!isOwner) {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            const sender = m.key.participant || m.participant;
            const isAdmin = participants.find(p => p.id === sender)?.admin;

            if (!isAdmin) {
                return sock.sendMessage(from, { text: '❌ Fitur ini hanya untuk admin grup!' }, { quoted: m });
            }
        }

        let bannedKeywords = loadBannedKeywords();
        const text = args.join(" ").toLowerCase();

        // Command: Toggle autobans on/off
        if (command === 'autobans') {
            if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) {
                const currentStatus = isAutobansEnabled(from);
                return sock.sendMessage(from, {
                    text: `🤖 *Auto-Delete Stiker*\n\nStatus saat ini: ${currentStatus ? '✅ Aktif' : '❌ Nonaktif'}\n\n*Cara pakai:*\n.autobans on  → Aktifkan\n.autobans off → Nonaktifkan\n\n⚠️ *Catatan:* Saat aktif, SEMUA stiker yang dikirim akan otomatis dihapus.`
                }, { quoted: m });
            }

            const newStatus = args[0].toLowerCase() === 'on';
            setAutobansStatus(from, newStatus);

            await sock.sendMessage(from, {
                text: `${newStatus ? '✅' : '❌'} Auto-Delete Stiker ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}!\n\n${newStatus ? '🚫 Bot akan otomatis menghapus SEMUA stiker yang dikirim.' : '⏸️ Bot tidak akan menghapus stiker.'}`
            }, { quoted: m });
        }
        // Command: Add banned keyword
        else if (command === 'addbansticker') {
            if (!text) {
                return sock.sendMessage(from, {
                    text: '❌ Masukkan kata kunci stiker yang ingin diblokir.\n\nContoh: .addbansticker nsfw'
                }, { quoted: m });
            }

            if (bannedKeywords.includes(text)) {
                return sock.sendMessage(from, { text: '❌ Kata kunci tersebut sudah ada di database.' }, { quoted: m });
            }

            bannedKeywords.push(text);
            saveBannedKeywords(bannedKeywords);
            await sock.sendMessage(from, {
                text: `✅ Berhasil menambahkan kata kunci "${text}" ke daftar stiker terlarang.`
            }, { quoted: m });
        }
        // Command: Delete banned keyword
        else if (command === 'delbansticker') {
            if (!text) {
                return sock.sendMessage(from, {
                    text: '❌ Masukkan kata kunci yang ingin dihapus.\n\nContoh: .delbansticker nsfw'
                }, { quoted: m });
            }

            if (!bannedKeywords.includes(text)) {
                return sock.sendMessage(from, { text: '❌ Kata kunci tersebut tidak ditemukan.' }, { quoted: m });
            }

            bannedKeywords = bannedKeywords.filter(w => w !== text);
            saveBannedKeywords(bannedKeywords);
            await sock.sendMessage(from, {
                text: `✅ Berhasil menghapus kata kunci "${text}" dari daftar stiker terlarang.`
            }, { quoted: m });
        }
        // Command: List banned keywords
        else if (command === 'listbansticker') {
            if (bannedKeywords.length === 0) {
                return sock.sendMessage(from, { text: '📝 Belum ada kata kunci stiker terlarang.' }, { quoted: m });
            }

            const list = bannedKeywords.map((w, i) => `${i + 1}. ${w}`).join('\n');
            await sock.sendMessage(from, {
                text: `📝 *Daftar Kata Kunci Stiker Terlarang:*\n\n${list}\n\n💡 Stiker yang mengandung kata kunci ini akan otomatis dihapus.`
            }, { quoted: m });
        }
    },

    // Auto-check function (called from message handler)
    checkSticker: async (sock, m) => {
        try {
            const from = m.key.remoteJid;
            const isGroup = from.endsWith('@g.us');

            if (!isGroup) return false;

            // Check if autobans is enabled for this group
            if (!isAutobansEnabled(from)) {
                return false; // Autobans disabled, skip check
            }

            // Check if message is a sticker
            if (!m.message?.stickerMessage) return false;

            console.log('[AutoBan] Sticker detected - deleting...');

            // Delete ALL stickers when autobans is enabled (silently, no notification)
            await sock.sendMessage(from, { delete: m.key });

            console.log('[AutoBan] Sticker deleted successfully');
            return true;

        } catch (error) {
            console.error('[AutoBan] Error deleting sticker:', error);
            return false;
        }
    }
};
