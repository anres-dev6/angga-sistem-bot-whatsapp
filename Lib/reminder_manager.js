import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REMINDER_FILE = path.join(__dirname, '../data/reminders.json');
let schedulerStarted = false;

// Pastikan folder data ada
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Load reminders dari file
function loadReminders() {
    try {
        if (!fs.existsSync(REMINDER_FILE)) return [];
        const raw = fs.readFileSync(REMINDER_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

// Simpan reminders ke file
function saveReminders(reminders) {
    fs.writeFileSync(REMINDER_FILE, JSON.stringify(reminders, null, 2));
}

// Generate ID unik
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// Tambah reminder baru
export function addReminder({ sender, from, message, triggerAt, repeat }) {
    const reminders = loadReminders();
    const id = generateId();

    reminders.push({
        id,
        sender,
        from,
        message,
        triggerAt,   // timestamp ms
        repeat,      // null | 'daily' | 'weekly'
        createdAt: Date.now()
    });

    saveReminders(reminders);
    return id;
}

// Hapus reminder by index (1-based) milik sender
export function deleteReminder(sender, index) {
    const reminders = loadReminders();
    const userReminders = reminders.filter(r => r.sender === sender);

    if (index < 1 || index > userReminders.length) return false;

    const target = userReminders[index - 1];
    const newReminders = reminders.filter(r => r.id !== target.id);
    saveReminders(newReminders);
    return true;
}

// Ambil semua reminder milik sender
export function getUserReminders(sender) {
    const reminders = loadReminders();
    return reminders.filter(r => r.sender === sender);
}

// Start scheduler — dipanggil sekali saat bot start
export function startReminderScheduler(sock) {
    if (schedulerStarted) return;
    schedulerStarted = true;
    console.log('[Reminder] Scheduler started');

    setInterval(async () => {
        const now = Date.now();
        const reminders = loadReminders();
        const remaining = [];

        for (const r of reminders) {
            if (now >= r.triggerAt) {
                // Kirim pesan reminder
                try {
                    const toMono = (str) => str.split('').map(c => {
                        const code = c.charCodeAt(0);
                        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D68A + (code - 97)); // a-z
                        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D670 + (code - 65));  // A-Z
                        if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7F6 + (code - 48));  // 0-9
                        return c;
                    }).join('');

                    const timeStr = new Date(r.triggerAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
                    });

                    const userNumber = r.sender.split('@')[0];
                    const text =
                        `🔔 Hai @${userNumber},\n\n` +
                        `⏰ ${toMono('REMINDER!')}\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n` +
                        `📌 ${toMono(r.message)}\n` +
                        `🕐 ${toMono(timeStr + ' WIB')}\n` +
                        (r.repeat ? `🔁 ${toMono('Berulang: ' + r.repeat)}\n` : '') +
                        `━━━━━━━━━━━━━━━━━━━━━`;

                    await sock.sendMessage(r.from, { text, mentions: [r.sender] });
                } catch (err) {
                    console.error('[Reminder] Send error:', err.message);
                }

                // Jika repeat, jadwalkan ulang ke masa depan agar tidak loop
                let nextTrigger = r.triggerAt;
                if (r.repeat === 'daily') {
                    while (nextTrigger <= now) {
                        nextTrigger += 24 * 60 * 60 * 1000;
                    }
                    remaining.push({ ...r, triggerAt: nextTrigger });
                } else if (r.repeat === 'weekly') {
                    while (nextTrigger <= now) {
                        nextTrigger += 7 * 24 * 60 * 60 * 1000;
                    }
                    remaining.push({ ...r, triggerAt: nextTrigger });
                }
                // Kalau tidak repeat → hapus (tidak di-push)
            } else {
                remaining.push(r);
            }
        }

        saveReminders(remaining);
    }, 15000); // Cek setiap 15 detik
}