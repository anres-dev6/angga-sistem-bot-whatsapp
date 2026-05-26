import axios from "axios";

export default {
  name: "ayat",
  aliases: ["ayat", "alquran", "quran"],
  tags: ["tobat"],
  description: "Cari ayat Al-Quran dengan terjemahan dan audio",

  access: {
    owner: false,
    group: false,
    private: false,
  },

  run: async (sock, msg, args) => {
    const from = msg.key.remoteJid;

    try {
      // .ayat <surah> <ayat>
      if (args.length < 2) {
        return await sock.sendMessage(from, {
          text: `📖 *Al-Quran*

❌ Format salah!

*Usage:*
.ayat [surah] [ayat]

*Contoh:*
.ayat 2 255
.ayat 1 1
.ayat 18 10`,
        });
      }

      const surah = parseInt(args[0]);
      const ayat = parseInt(args[1]);

      if (isNaN(surah) || isNaN(ayat)) {
        return await sock.sendMessage(from, {
          text: "❌ Nomor surah dan ayat harus angka!\n\n💡 Contoh: .ayat 2 255",
        });
      }

      await sock.sendMessage(from, {
        react: { text: "⏳", key: msg.key },
      });

      const url = `https://api.quran.sutanlab.id/surah/${surah}/${ayat}`;

      const res = await axios.get(url);
      const verse = res?.data?.data;

      if (!verse) {
        await sock.sendMessage(from, {
          react: { text: "❌", key: msg.key },
        });

        return await sock.sendMessage(from, {
          text: `❌ Ayat tidak ditemukan!

💡 Cek nomor surah & ayat:
• Surah: 1–114
• Ayat: sesuai jumlah ayat di surah

Contoh:
.ayat 2 255`,
        });
      }

      const arabic = verse.text.arab;
      const translation = verse.translation.id;
      const surahName = verse.surah.name.transliteration.id;
      const audioUrl = verse.audio.primary;

      const messageText = `📖 *${surahName}* — ${surah}:${ayat}

${arabic}

*Artinya:*
${translation}`;

      await sock.sendMessage(from, {
        react: { text: "✅", key: msg.key },
      });

      await sock.sendMessage(from, { text: messageText });

      if (audioUrl) {
        await sock.sendMessage(from, {
          audio: { url: audioUrl },
          mimetype: "audio/mp4",
          ptt: false,
        });
      }
    } catch (error) {
      console.error("[Ayat] Error:", error);

      await sock.sendMessage(from, {
        react: { text: "❌", key: msg.key },
      });

      return await sock.sendMessage(from, {
        text: `❌ Error mengambil data Al-Quran

• API bisa jadi down
• Nomor surah/ayat salah
• Koneksi lemot

Coba lagi nanti.`,
      });
    }
  },
};