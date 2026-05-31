import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, '..', '..', 'data', 'uud1945.json');

export default {
    name: 'uud',
    aliases: ['uud', 'uud1945', 'konstitusi'],
    tags: ['utility'],
    description: 'Mencari dan menampilkan isi Undang-Undang Dasar (UUD) 1945',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        // Ensure database exists
        if (!fs.existsSync(jsonPath)) {
            return sock.sendMessage(from, { 
                text: '❌ Database UUD 1945 tidak ditemukan. Harap hubungi owner untuk menjalankan setup.' 
            }, { quoted: msg });
        }

        const uudData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        if (!args || args.length === 0) {
            // Show help/usage menu
            const usageMsg = `🏛️ *KONSITUSI REPUBLIK INDONESIA* 🏛️
*UNDANG-UNDANG DASAR NEGARA REPUBLIK INDONESIA TAHUN 1945*

💡 *Cara Penggunaan:*
• *.uud pasal <nomor_pasal>*
  Contoh: _.uud pasal 1_
• *.uud pasal <nomor_pasal> ayat <nomor_ayat>*
  Contoh: _.uud pasal 28A ayat 1_

⚡ *Pencarian Singkat:*
• *.uud 1* (Menampilkan Pasal 1)
• *.uud 28A 1* (Menampilkan Pasal 28A Ayat 1)

📊 *Statistik UUD 1945:*
• Total Pasal: *${Object.keys(uudData).length} Pasal* (Termasuk amandemen)
• Sumber: _JDIH Badan Pengawas Tenaga Nuklir (BAPETEN)_`;

            return sock.sendMessage(from, { text: usageMsg }, { quoted: msg });
        }

        const query = args.join(' ').toLowerCase();
        let pasal = null;
        let ayat = null;

        // 1. Look for explicit keywords "pasal" and "ayat"
        const pasalKeywordMatch = query.match(/pasal\s*(\d+[a-z]*)/i);
        const ayatKeywordMatch = query.match(/ayat\s*(\d+)/i);

        if (pasalKeywordMatch) {
            pasal = pasalKeywordMatch[1].toUpperCase();
        }
        if (ayatKeywordMatch) {
            ayat = ayatKeywordMatch[1];
        }

        // 2. If no keywords are found, fall back to numeric pattern matching
        if (!pasal) {
            const numbers = query.match(/\b\d+[a-z]*\b/gi);
            if (numbers && numbers.length > 0) {
                pasal = numbers[0].toUpperCase();
                if (numbers.length > 1 && !ayat) {
                    const secondNum = numbers[1].match(/^\d+$/);
                    if (secondNum) {
                        ayat = secondNum[0];
                    }
                }
            }
        }

        if (!pasal) {
            return sock.sendMessage(from, { 
                text: '❌ Format salah. Contoh format yang benar:\n• *.uud pasal 1*\n• *.uud pasal 28A ayat 1*' 
            }, { quoted: msg });
        }

        // Find the pasal in data
        const pasalData = uudData[pasal];

        if (!pasalData) {
            return sock.sendMessage(from, { 
                text: `❌ *Pasal ${pasal}* tidak ditemukan dalam UUD 1945.` 
            }, { quoted: msg });
        }

        const babName = pasalData.bab || 'TANPA BAB';
        const allAyat = pasalData.ayat;

        if (ayat) {
            // Specific ayat requested
            const ayatText = allAyat[ayat];
            if (!ayatText) {
                return sock.sendMessage(from, { 
                    text: `❌ *Pasal ${pasal} Ayat ${ayat}* tidak ditemukan.\n\n💡 Pasal ${pasal} memiliki *${Object.keys(allAyat).length}* ayat.` 
                }, { quoted: msg });
            }

            const outputMsg = `🏛️ *UUD 1945 - ${babName}*

*Pasal ${pasal} Ayat ${ayat}:*
${ayatText}`;

            return sock.sendMessage(from, { text: outputMsg }, { quoted: msg });
        } else {
            // Show all ayat in the pasal, formatted per ayat = new line
            const formattedAyats = [];
            const sortedAyatsKeys = Object.keys(allAyat).sort((a, b) => parseInt(a) - parseInt(b));

            for (const key of sortedAyatsKeys) {
                // If there's only 1 paragraph/ayat and it has no number or is just text, don't show the number prefix in a weird way
                if (sortedAyatsKeys.length === 1 && key === '1' && !allAyat[key].startsWith('1.')) {
                    formattedAyats.push(`${allAyat[key]}`);
                } else {
                    formattedAyats.push(`*(${key})* ${allAyat[key]}`);
                }
            }

            const outputMsg = `🏛️ *UUD 1945 - ${babName}*

*Pasal ${pasal}:*
${formattedAyats.join('\n\n')}`;

            return sock.sendMessage(from, { text: outputMsg }, { quoted: msg });
        }
    }
};
