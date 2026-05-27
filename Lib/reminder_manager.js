import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REMINDER_FILE = path.join(__dirname, '../data/reminders.json');
let schedulerStarted = false;
const cronJobs = new Map(); // Simpan referensi cron jobs

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

// Helper: Convert to monospace
function toMono(str) {
    return str.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D68A + (code - 97)); // a-z
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D670 + (code - 65));  // A-Z
        if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7F6 + (code - 48));  // 0-9
        return c;
    }).join('');
}

// Buat cron expression dari timestamp
function getCronExpression(timestamp) {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const hours = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${minutes} ${hours} ${day} ${month} *`;
}

// Start scheduler dengan node-cron
export function startReminderScheduler(sock) {
    if (schedulerStarted) return;
    schedulerStarted = true;
    console.log('[Reminder] Scheduler started with node-cron');

    // Reload reminders dan setup cron jobs setiap interval
    setInterval(async () => {
        const reminders = loadReminders();
        const now = Date.now();

        for (const r of reminders) {
            // Skip jika sudah ada cron job untuk reminder ini
            if (cronJobs.has(r.id)) continue;

            // Skip jika waktu sudah lewat (untuk non-repeat)
            if (!r.repeat && now >= r.triggerAt) {
                continue;
            }

            // Buat cron job untuk reminder ini
            const cronExpr = getCronExpression(r.triggerAt);
            
            try {
                const job = cron.schedule(cronExpr, async () => {
                    try {
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
                        console.log(`[Reminder] Sent: ${r.message}`);
                    } catch (err) {
                        console.error('[Reminder] Send error:', err.message);
                    }

                    // Jika tidak repeat, hapus reminder
                    if (!r.repeat) {
                        const reminders = loadReminders();
                        const updated = reminders.filter(rm => rm.id !== r.id);
                        saveReminders(updated);
                        cronJobs.delete(r.id);
                        job.stop();
                    } else if (r.repeat === 'daily' || r.repeat === 'weekly') {
                        // Update triggerAt untuk next occurrence
                        const increment = r.repeat === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
                        r.triggerAt += increment;
                        
                        const reminders = loadReminders();
                        const idx = reminders.findIndex(rm => rm.id === r.id);
                        if (idx !== -1) {
                            reminders[idx].triggerAt = r.triggerAt;
                            saveReminders(reminders);
                        }

                        cronJobs.delete(r.id);
                        job.stop();
                    }
                });

                cronJobs.set(r.id, job);
            } catch (err) {
                console.error(`[Reminder] Failed to create cron job for ${r.id}:`, err.message);
            }
        }

        // Cleanup: Hapus cron jobs untuk reminder yang sudah dihapus
        const currentIds = new Set(reminders.map(r => r.id));
        for (const [id, job] of cronJobs) {
            if (!currentIds.has(id)) {
                job.stop();
                cronJobs.delete(id);
            }
        }
    }, 5000); // Check setiap 5 detik
}

// Cleanup saat bot shutdown
export function stopReminderScheduler() {
    for (const [, job] of cronJobs) {
        job.stop();
    }
    cronJobs.clear();
    console.log('[Reminder] Scheduler stopped');
}