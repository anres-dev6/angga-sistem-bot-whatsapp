const axios = require("axios");

// =====================================
//  COMMAND: .ayat <surah> <ayat> [tafsir]
//  contoh:
//  .ayat 2 255
//  .ayat 2 255 tafsir
// =====================================

async function handleAyatCommand(sock, msg) {
  try {
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    const args = text.trim().split(/\s+/);

    // prefix titik
    if (args[0] !== ".ayat") return;

    // cek minimal parameter
    if (args.length < 3) {
      await sock.sendMessage(msg.key.remoteJid, {
        text:
`Format:
.ayat <surah> <ayat>

Contoh:
.ayat 2 255
.ayat 36 1 tafsir`
      });
      return;
    }

    const surah = Number(args[1]);
    const ayat  = Number(args[2]);
    const withTafsir = args[3] && args[3].toLowerCase() === "tafsir";

    // validasi
    if (isNaN(surah) || isNaN(ayat)) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "Nomor surah / ayat harus angka. Cek lagi."
      });
      return;
    }

    const url = `https://api.quran.sutanlab.id/surah/${surah}/${ayat}`;

    const res = await axios.get(url);
    const verse = res?.data?.data;

    if (!verse) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "Ayat tidak ditemukan. Coba ganti nomor."
      });
      return;
    }

    const arabic      = verse.text.arab;
    const translation = verse.translation.id;
    const surahName   = verse.surah.name.transliteration.id;
    const revelation  = verse.surah.revelation.id;
    const audioUrl    = verse.audio.primary;
    const tafsir      = verse.tafsir?.id?.short || "Tafsir tidak tersedia.";

    let messageText =
`📖 ${surahName} (${revelation})
Surah: ${surah}  |  Ayat: ${ayat}

${arabic}

Artinya:
${translation}`;

    if (withTafsir) {
      messageText += `

Tafsir singkat:
${tafsir}`;
    }

    // kirim teks
    await sock.sendMessage(msg.key.remoteJid, {
      text: messageText
    });

    // kirim audio
    if (audioUrl) {
      await sock.sendMessage(msg.key.remoteJid, {
        audio: { url: audioUrl },
        mimetype: "audio/mp4"
      });
    }

  } catch (err) {
    console.error(err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: "Lagi error ambil data. Coba sebentar lagi."
    });
  }
}

module.exports = { handleAyatCommand };