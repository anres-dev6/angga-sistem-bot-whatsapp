// lib/riddles.js
const riddles = [
  { q: "Ada sebuah ember berisi 5 apel. Lo ambil 3. Berapa apel yang lo punya?", a: "Lo punya 3 (lo ambil 3)." },
  { q: "Dua orang naik kapal tapi cuma satu baju renang dibawa. Kenapa keduanya tetap kering?", a: "Karena keduanya tidak berenang (atau jawab jebakan lain yang cocok)." },
  { q: "Satu doktor bilang: 'Saya bukan bapaknya.' Seorang anak bilang: 'Itu anak saya.' Siapa yang bohong?", a: "Tidak ada yang bohong — dokter bisa jadi ibunya." },
  { q: "Ada satu menit yang panjangnya 60 detik. Ada satu menit yang panjangnya 61 detik. Di mana menit yang 61 detik itu?", a: "Saat leap second (detik lompatan)." },
  { q: "Kalau 3 kucing tangkap 3 tikus dalam 3 menit, berapa menit 1 kucing butuh untuk tangkep 1 tikus?", a: "3 menit." },
  { q: "Kalau lo masuk rumah dengan payung basah, terus payungnya lo taro di meja, payung kering atau tetap basah?", a: "Tetap basah (menaruhnya di meja nggak bikin kering)." },
  { q: "Ada 3 kotak: emas, perak, kosong. Semua label salah. Boleh buka 1 kotak. Bagaimana tahu yang emas?", a: "Buka kotak berlabel 'kosong' → karena label salah, dari isinya deduce posisi yang lain." },
  { q: "Apa yang punya banyak gigi tapi nggak pernah bisa makan?", a: "Sisir." },
  { q: "Seorang ayah dan anak kecelakaan. Dokter bilang 'Itu anak saya.' Gimana bisa?", a: "Dokter itu ibunya." },
  { q: "Lo punya satu korek api, masuk kamar gelap—ada lampu minyak, kompor, dan lilin. Mana yang harus dinyalain dulu?", a: "Korek api dulu." },
  { q: "Kalau dipotong malah tambah panjang. Apa?", a: "jalan" },
  { q: "Punya gigi tapi gak bisa makan?", a: "sisir" },
];

// In-memory map: chatId -> { q, a, time }
const lastRiddle = new Map();

function randomInt(max) { return Math.floor(Math.random() * max); }

function getRandomRiddle() {
  const idx = randomInt(riddles.length);
  return { idx, ...riddles[idx] };
}

function getAllShuffled() {
  const arr = riddles.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export { riddles, getRandomRiddle, lastRiddle, getAllShuffled };