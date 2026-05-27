# 📋 Panduan Remind Command - UPDATED ✅

## 🔧 Yang Sudah Diperbaiki

### 1. **Smart Time Parser** ✨
- ✅ Format `m/h/d` (minutes/hours/days) sekarang fully supported
- ✅ Parser intelligent untuk memisahkan waktu dan alasan
- ✅ Support format singkat (1m, 2h, 3d) dan panjang (1menit, 2jam, 3hari)
- ✅ Case-insensitive parsing untuk Indonesia dan English

### 2. **Library Scheduling** 🚀
- ✅ Installed: **node-cron** untuk scheduling yang lebih reliable
- ✅ Cron jobs untuk precision timing
- ✅ Automatic cleanup untuk completed reminders
- ✅ Support repeating reminders (daily/weekly)

### 3. **Bot Auto-Run** ⚙️
- ✅ Bot automatically jalankan scheduler saat koneksi dibuka
- ✅ Check every 5 seconds untuk pending reminders
- ✅ Reliable message delivery dengan mentions

---

## 📝 Format Command

### **Basic Format**
```
.remind <TIME> <REASON>
```

### **Supported Time Formats**

| Format | Contoh | Keterangan |
|--------|--------|-----------|
| Minutes | `.remind 1m` atau `.remind 1min` | Dalam menit |
| Hours | `.remind 2h` atau `.remind 2jam` | Dalam jam |
| Days | `.remind 3d` atau `.remind 3hari` | Dalam hari |
| Seconds | `.remind 30s` atau `.remind 30detik` | Dalam detik (optional) |
| Specific Time | `.remind 08:30` | Jam 08:30 WIB hari ini |
| Tomorrow Time | `.remind besok 08:30` | Besok jam 08:30 WIB |
| Daily Repeat | `.remind 08:30-daily` | Setiap hari jam 08:30 |
| Weekly Repeat | `.remind 08:30-weekly` | Setiap minggu jam 08:30 |

---

## 💡 Contoh Penggunaan

### ✅ Bekerja Sekarang

```
.remind 1m minum obat
.remind 2h meeting dengan klien
.remind 3d ulang tahun mama
.remind 30s testing reminder
.remind 08:30 sholat dhuha
.remind besok 10:00 meeting dengan boss
.remind 08:30-daily sholat subuh
.remind 21:00-weekly qurban hari jum'at
```

### Output Confirmation
```
✅ Reminder berhasil dibuat!
━━━━━━━━━━━━━━━━━━━━━
📌 minum obat
🕐 Rabu, 27 Mei 2026, 07:50 WIB
⏳ 1 menit lagi
━━━━━━━━━━━━━━━━━━━━━
💡 .remind list » lihat semua reminder
```

---

## 🎯 Sub Commands

### List Reminders
```
.remind list
.remind ls
.remind daftar
```

### Delete Reminder
```
.remind del 1          # Hapus reminder nomor 1
.remind delete 1
.remind hapus 1
```

### Help
```
.remind help
.remind
```

---

## 🔍 Smart Parser Logic

### Time Detection
Parser secara otomatis mendeteksi format waktu di argument pertama:
- Jika `arg[0]` = `\d+m|h|d|s` → dianggap sebagai time
- Jika `arg[0]` = `HH:MM` atau `HH.MM` → dianggap sebagai time
- Jika `arg[0]` = `besok|tomorrow` → next arg adalah time
- Rest of args → dianggap sebagai message/reason

### Examples
```
Input: .remind 1m minum obat
Parse: time="1m", message="minum obat"

Input: .remind 08:30 sholat
Parse: time="08:30", message="sholat"

Input: .remind besok 10:00 meeting
Parse: time="besok 10:00", message="meeting"
```

---

## 🔔 Reminder Notification

Saat reminder trigger, bot akan mengirim:

```
🔔 Hai @user,

⏰ 𝙍𝙀𝙈𝙄𝙉𝘿𝙀𝙍!
━━━━━━━━━━━━━━━━━━━━━
📌 minum obat
🕐 07:50 WIB
━━━━━━━━━━━━━━━━━━━━━
```

---

## ⚡ Technical Details

### Scheduler Implementation
- **Type**: Node.js `setInterval` + `node-cron`
- **Interval**: 5 seconds check untuk pending reminders
- **Storage**: JSON file-based (`/data/reminders.json`)
- **Timezone**: Asia/Jakarta (WIB)

### Repeat Logic
- **Daily**: Reminder repeats setiap 24 jam pada waktu yang sama
- **Weekly**: Reminder repeats setiap 7 hari pada waktu yang sama
- **Non-repeat**: Reminder dihapus otomatis setelah dijalankan

---

## 🚀 Troubleshooting

### Reminder Tidak Trigger?
1. Pastikan bot masih connect (check `.ping` command)
2. Check `.remind list` apakah reminder sudah tersimpan
3. Verifikasi format waktu sesuai dengan contoh di atas
4. Pastikan pesan reminder tidak kosong

### Parser Error?
Jika error dengan format:
```
❌ Format salah!

Format yang benar:
.remind 1m alasan (1 menit)
.remind 2h alasan (2 jam)
.remind 3d alasan (3 hari)
.remind 08:30 alasan (jam 08:30)
```

Ini berarti format waktu tidak dikenali. Gunakan format dari tabel di atas.

---

## 📊 Live Examples

### Scenario 1: Set reminder dalam 5 menit
```
User: .remind 5m call mom
Bot:  ✅ Reminder berhasil dibuat!
      📌 call mom
      🕐 Rabu, 27 Mei 2026, 07:42 WIB
      ⏳ 5 menit lagi
      
[5 menit kemudian...]

Bot: 🔔 Hai @user,
     ⏰ REMINDER!
     📌 call mom
     🕐 07:47 WIB
```

### Scenario 2: Daily reminder
```
User: .remind 06:00-daily sholat subuh
Bot:  ✅ Reminder berhasil dibuat!
      📌 sholat subuh
      🕐 Rabu, 27 Mei 2026, 06:00 WIB
      🔁 Berulang: daily
      
[Setiap hari pukul 06:00 WIB, bot akan mengirim reminder]
```

---

**Last Update**: 27 Mei 2026  
**Status**: ✅ Production Ready  
**Library**: node-cron v3.x+
