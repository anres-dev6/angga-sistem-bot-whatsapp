# Auto-Ban Stiker Tidak Pantas

Sistem otomatis untuk mendeteksi dan menghapus stiker yang tidak pantas di grup WhatsApp.

## Fitur

✅ **AI Vision Analysis** - Menggunakan Gemini AI untuk analisis gambar stiker
✅ **Keyword Management** - Tambah/hapus kata kunci stiker terlarang
✅ **Auto Delete** - Otomatis hapus stiker yang terdeteksi tidak pantas
✅ **Warning System** - Kirim peringatan ke grup dengan mention pengirim
✅ **Admin Only** - Hanya admin grup yang bisa manage kata kunci

## Commands

### 1. Tambah Kata Kunci
```
.addbansticker [kata kunci]
```
**Contoh:**
```
.addbansticker nsfw
.addbansticker vulgar
.addbansticker kekerasan
```

### 2. Hapus Kata Kunci
```
.delbansticker [kata kunci]
```
**Contoh:**
```
.delbansticker nsfw
```

### 3. Lihat Daftar Kata Kunci
```
.listbansticker
```

## Cara Kerja

1. **User kirim stiker** di grup
2. **Bot download stiker** untuk analisis
3. **AI analisis gambar** menggunakan Gemini Vision
4. **Jika terdeteksi tidak pantas:**
   - ❌ Stiker dihapus otomatis
   - ⚠️ Bot kirim peringatan ke grup
   - 👤 Mention pengirim
   - 📝 Tampilkan alasan dari AI

## Setup AI (Gemini API)

1. Dapatkan API Key dari: https://makersuite.google.com/app/apikey
2. Set environment variable:
   ```bash
   set GEMINI_API_KEY=your_api_key_here
   ```
3. Atau edit langsung di `autobans.js` line 41

## Default Kata Kunci

Kata kunci default yang sudah ter-load:
- nsfw
- porn
- telanjang
- bugil
- nude
- sex
- vulgar
- kekerasan
- violence
- gore
- hate
- racism
- sara
- hoax
- penipuan
- Orang Kulit Hitam
- gay
- pembunuhan
- jorok
- manusia

## Permissions

- ✅ **Owner Bot**: Full access
- ✅ **Admin Grup**: Bisa manage kata kunci
- ❌ **Member Biasa**: Tidak bisa akses command

## File Storage

Kata kunci disimpan di:
```
c:\Angga-Bot\Lib\banned_stickers.json
```

## Optional: Auto-Kick

Jika ingin otomatis kick user yang kirim stiker tidak pantas, uncomment line ini di `autobans.js`:

```javascript
// Line ~210
await sock.groupParticipantsUpdate(from, [sender], 'remove');
```

## Troubleshooting

### AI tidak bekerja?
- Pastikan `GEMINI_API_KEY` sudah di-set
- Check console log untuk error
- Pastikan API key valid

### Stiker tidak terdeteksi?
- AI mungkin tidak sempurna
- Tambahkan kata kunci manual dengan `.addbansticker`
- Check console log untuk debug info

### Command tidak bisa dipakai?
- Pastikan Anda admin grup
- Pastikan bot sudah restart setelah update

## Tips

1. **Kombinasi AI + Keywords** untuk deteksi maksimal
2. **Update kata kunci** secara berkala
3. **Monitor console log** untuk lihat AI analysis
4. **Test dulu** sebelum enable auto-kick

## Example Usage

```
Admin: .addbansticker hoax
Bot: ✅ Berhasil menambahkan kata kunci "hoax" ke daftar stiker terlarang.

Admin: .listbansticker
Bot: 📝 Daftar Kata Kunci Stiker Terlarang:
     1. nsfw
     2. porn
     3. hoax
     ...

[User kirim stiker NSFW]
Bot: ⚠️ Stiker Tidak Pantas Terdeteksi!
     👤 Pengirim: @user
     🤖 Alasan: UNSAFE - Contains NSFW content
     ❌ Stiker telah dihapus otomatis.
```

## Notes

- AI analysis membutuhkan internet connection
- Proses analisis ~2-3 detik per stiker
- File stiker di-download sementara untuk analisis
- Tidak ada stiker yang disimpan permanent
