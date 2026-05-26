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
                        if (c >= 'a' && c <= 'z') return String.fromCodePoint(0x1D670 + (c.charCodeAt(0) - 97));
                        if (c >= 'A' && c <= 'Z') return String.fromCodePoint(0x1D656 + (c.charCodeAt(0) - 65));
                        if (c >= '0' && c <= '9') return String.fromCodePoint(0x1D7F6 + (c.charCodeAt(0) - 48));
                        return c;
                    }).join('');

                    const timeStr = new Date(r.triggerAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
                    });

                    const text =
                        `⏰ ${toMono('REMINDER!')}\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n` +
                        `📌 ${toMono(r.message)}\n` +
                        `🕐 ${toMono(timeStr + ' WIB')}\n` +
                        (r.repeat ? `🔁 ${toMono('Berulang: ' + r.repeat)}\n` : '') +
                        `━━━━━━━━━━━━━━━━━━━━━`;

                    await sock.sendMessage(r.from, { text }, { mentions: [r.sender] });
                } catch (err) {
                    console.error('[Reminder] Send error:', err.message);
                }

                // Jika repeat, jadwalkan ulang
                if (r.repeat === 'daily') {
                    remaining.push({ ...r, triggerAt: r.triggerAt + 24 * 60 * 60 * 1000 });
                } else if (r.repeat === 'weekly') {
                    remaining.push({ ...r, triggerAt: r.triggerAt + 7 * 24 * 60 * 60 * 1000 });
                }
                // Kalau tidak repeat → hapus (tidak di-push)
            } else {
                remaining.push(r);
            }
        }

        saveReminders(remaining);
    }, 15000); // Cek setiap 15 detik
}