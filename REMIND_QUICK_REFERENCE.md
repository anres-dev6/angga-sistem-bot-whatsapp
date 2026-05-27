# 🎯 REMIND COMMAND - QUICK REFERENCE

## ✅ FIXED ISSUES
- ✅ `.remind 1m reason` sekarang fully functional
- ✅ Smart parser memisahkan time dan message dengan cerdas
- ✅ Bot auto-run scheduler saat connected
- ✅ Precision timing dengan node-cron (minute-level)

---

## 📋 COMMAND FORMATS

### ⏱️ Relative Time
```
.remind 10m test          → 10 menit lagi
.remind 10min test        → sama (alternative)
.remind 10menit test      → sama (Indonesian)
.remind 2h meeting        → 2 jam lagi
.remind 2jam meeting      → sama (Indonesian)
.remind 3d reminder       → 3 hari lagi
.remind 3hari reminder    → sama (Indonesian)
.remind 30s test          → 30 detik (optional)
```

### 🕐 Specific Time
```
.remind 08:30 sholat      → Hari ini jam 08:30
.remind 08.30 sholat      → Sama (alternative dot)
.remind besok 10:00 meet  → Besok jam 10:00
```

### 🔁 Repeating
```
.remind 08:30-daily test  → Setiap hari jam 08:30
.remind 08:30-harian test → Sama (Indonesian)
.remind 21:00-weekly test → Setiap minggu jam 21:00
.remind 21:00-mingguan t  → Sama (Indonesian)
```

---

## 🎮 SUB COMMANDS

```
.remind list      → Lihat semua reminder
.remind ls        → Alias untuk list
.remind daftar    → Alias (Indonesian)

.remind del 1     → Hapus reminder #1
.remind delete 1  → Alias
.remind hapus 1   → Alias (Indonesian)

.remind help      → Bantuan lengkap
.remind           → Sama (default)
```

---

## 💯 WORKING EXAMPLES

### Scenario 1: Quick Reminder
```
User: .remind 5m call mom
Bot:  ✅ Reminder berhasil dibuat!
      📌 call mom
      🕐 Rabu, 27 Mei 2026, 07:42 WIB
      ⏳ 5 menit lagi
```

### Scenario 2: Specific Time Today
```
User: .remind 08:30 sholat
Bot:  ✅ Reminder berhasil dibuat!
      📌 sholat
      🕐 Rabu, 27 Mei 2026, 08:30 WIB
      ⏳ 53 menit lagi
```

### Scenario 3: Tomorrow Reminder
```
User: .remind besok 10:00 meeting
Bot:  ✅ Reminder berhasil dibuat!
      📌 meeting
      🕐 Kamis, 28 Mei 2026, 10:00 WIB
      ⏳ 1 jam 23 menit lagi
```

### Scenario 4: Daily Repeat
```
User: .remind 06:00-daily sholat subuh
Bot:  ✅ Reminder berhasil dibuat!
      📌 sholat subuh
      🕐 Rabu, 27 Mei 2026, 06:00 WIB
      🔁 Berulang: daily

[Bot akan kirim reminder setiap hari jam 06:00]
```

### Scenario 5: List & Delete
```
User: .remind list
Bot:  [1] 📌 call mom
          🕐 27 May 07:42 WIB (5 menit lagi)
      [2] 📌 sholat
          🕐 27 May 08:30 WIB (53 menit lagi)
      [3] 📌 meeting
          🕐 28 May 10:00 WIB (1 jam 23 menit lagi)

User: .remind del 1
Bot:  ✅ Reminder #1 berhasil dihapus!
```

---

## ❌ ERROR HANDLING

### Format Salah
```
.remind test
❌ Format salah!
Format yang benar:
.remind 1m alasan (1 menit)
.remind 2h alasan (2 jam)
.remind 3d alasan (3 hari)
.remind 08:30 alasan (jam 08:30)
```

### Pesan Kosong
```
.remind 1m
❌ Pesan reminder kosong!
💡 .remind 10m Minum obat
💡 .remind help » lihat panduan
```

### Invalid Time
```
.remind 25:00 test
❌ Format waktu tidak dikenali: 25:00
💡 Contoh: 10m, 2h, 1d, 08:30, besok 08:30
💡 .remind help » lihat panduan lengkap
```

---

## 🔧 TECHNICAL INFO

| Property | Value |
|----------|-------|
| Parser Type | Smart Regex + Logic |
| Scheduler | node-cron v4.2.1 |
| Check Interval | 5 seconds |
| Timezone | Asia/Jakarta (WIB) |
| Storage | JSON (reminders.json) |
| Precision | ±1 minute |

---

## 🚀 QUICK START

1. **Set 1 minute reminder**
   ```
   .remind 1m test reason
   ```

2. **Wait 1 minute for notification**
   ```
   🔔 Hai @user,
   ⏰ REMINDER!
   📌 test reason
   🕐 07:50 WIB
   ```

3. **Check all reminders**
   ```
   .remind list
   ```

4. **Delete a reminder**
   ```
   .remind del 1
   ```

---

## 💡 TIPS

✅ **DO**
- Gunakan format dari tabel di atas
- Pastikan bot connected sebelum set reminder
- Check `.remind list` untuk verify
- Delete reminder yang sudah tidak perlu

❌ **DON'T**
- Jangan gunakan format sembarangan
- Jangan set time di masa lalu
- Jangan set reminder kosong
- Jangan restart bot saat reminder aktif (data aman di file)

---

## 📞 NEED HELP?

| Issue | Solution |
|-------|----------|
| Reminder tidak trigger | 1. Check bot connected (`.ping`) <br> 2. Check `.remind list` <br> 3. Verify format |
| Bot disconnect | Bot otomatis reconnect <br> Reminder state saved di file |
| Modify existing reminder | `.remind del [nomor]` <br> Buat reminder baru |
| Timezone issue | Hardcoded ke Asia/Jakarta (WIB) |

---

**Last Updated**: 27 Mei 2026 | Status: ✅ Ready to Use
