import { addReminder, deleteReminder, getUserReminders } from '../../Lib/reminder_manager.js';

const toMono = (str) => str.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D68A + (code - 97)); // a-z
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D670 + (code - 65));  // A-Z
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7F6 + (code - 48));  // 0-9
    return c;
}).join('');

const LINE = '━━━━━━━━━━━━━━━━━━━━━';

/**
 * Smart time parser dengan support m/h/d dan lokalisasi
 * Format: 10m, 2h, 1d, 10menit, 2jam, 1hari, 30detik, 30s
 *         HH:MM, HH.MM, besok HH:MM, HH:MM-daily, HH:MM-weekly
 */
function parseTime(timeStr, forceTomorrow = false) {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const now = Date.now();
    timeStr = timeStr.toLowerCase().trim();

    // Match relative formats dengan regex yang lebih fleksibel
    // Support: 10m, 10min, 10menit, 2h, 2hour, 2jam, 1d, 1day, 1hari, 30s, 30sec, 30detik
    const durationMatch = timeStr.match(/^(\d+)\s*(m|min|menit|h|hour|jam|d|day|hari|s|sec|detik)$/i);
    if (durationMatch) {
        const val = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();

        if (unit === 's' || unit === 'sec' || unit === 'detik') {
            return { triggerAt: now + val * 1000, repeat: null };
        }
        if (unit === 'm' || unit === 'min' || unit === 'menit') {
            return { triggerAt: now + val * 60 * 1000, repeat: null };
        }
        if (unit === 'h' || unit === 'hour' || unit === 'jam') {
            return { triggerAt: now + val * 60 * 60 * 1000, repeat: null };
        }
        if (unit === 'd' || unit === 'day' || unit === 'hari') {
            return { triggerAt: now + val * 24 * 60 * 60 * 1000, repeat: null };
        }
    }

    // Format jam: HH:MM, HH.MM dengan optional repeat suffix
    const clockMatch = timeStr.match(/^(\d{1,2})[:.](\d{2})(?:\s*-\s*(daily|weekly|harian|mingguan))?$/i);
    if (clockMatch) {
        const [, hh, mm, repeatSuffix] = clockMatch;
        let repeat = null;
        
        if (repeatSuffix) {
            const repeatLower = repeatSuffix.toLowerCase();
            repeat = (repeatLower === 'daily' || repeatLower === 'harian') ? 'daily' : 
                     (repeatLower === 'weekly' || repeatLower === 'mingguan') ? 'weekly' : null;
        }

        const target = new Date();
        const hours = parseInt(hh);
        const minutes = parseInt(mm);

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null; // Invalid time
        }

        target.setHours(hours, minutes, 0, 0);

        if (forceTomorrow) {
            target.setDate(target.getDate() + 1);
        } else if (target.getTime() <= now) {
            if (repeat === 'weekly') {
                target.setDate(target.getDate() + 7);
            } else {
                target.setDate(target.getDate() + 1);
            }
        }

        return { triggerAt: target.getTime(), repeat };
    }

    return null;
}

/**
 * Pisahkan format time dan message dari args
 * Return: { timeStr, message }
 */
function smartParsing(args) {
    if (!args || args.length === 0) return { timeStr: null, message: null };

    const firstArg = args[0].toLowerCase();
    
    // Check if first arg is time pattern
    const isTimeFormat = /^(\d+\s*(m|min|menit|h|hour|jam|d|day|hari|s|sec|detik))$/i.test(firstArg) ||
                         /^(\d{1,2}[:.](\d{2}))/.test(firstArg) ||
                         firstArg === 'besok' || firstArg === 'tomorrow';

    if (!isTimeFormat) {
        return { timeStr: null, message: null };
    }

    // Handle "besok" case
    if (firstArg === 'besok' || firstArg === 'tomorrow') {
        if (args.length >= 2 && /^(\d{1,2}[:.](\d{2}))/.test(args[1])) {
            const timeStr = args[1];
            const message = args.slice(2).join(' ').trim();
            return { timeStr, message, forceTomorrow: true };
        }
        return { timeStr: null, message: null };
    }

    // For regular time format, extract time and message
    const timeStr = args[0];
    const message = args.slice(1).join(' ').trim();
    
    return { timeStr, message, forceTomorrow: false };
}

// Format ms ke teks singkat
function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const jam = Math.floor(totalSec / 3600);
    const menit = Math.floor((totalSec % 3600) / 60);

    if (jam > 0 && menit > 0) return `${jam} jam ${menit} menit`;
    if (jam > 0) return `${jam} jam`;
    return `${menit} menit`;
}

export default {
    name: 'remind',
    aliases: ['reminder', 'ingatkan'],
    tags: ['tools'],
    description: 'Set pengingat / reminder',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m, args, context) => {
        const sender = context?.sender || m.sender || m.key.participant || m.participant;
        const from = context?.from || m.key.remoteJid;

        const subCmd = args[0]?.toLowerCase();

        // ── .remind list ──────────────────────────────
        if (subCmd === 'list' || subCmd === 'ls' || subCmd === 'daftar') {
            const reminders = getUserReminders(sender);

            if (reminders.length === 0) {
                return sock.sendMessage(from, {
                    text:
                        `${toMono('cmd')} : ${toMono('.remind list')}\n${LINE}\n` +
                        `📭 ${toMono('Belum ada reminder aktif.')}\n` +
                        `${LINE}\n` +
                        `💡 ${toMono('.remind 10m Minum obat')}`,
                }, { quoted: m.key ? m : undefined });
            }

            let text = `${toMono('cmd')} : ${toMono('.remind list')}\n${LINE}\n`;

            reminders.forEach((r, i) => {
                const timeLeft = r.triggerAt - Date.now();
                const jam = new Date(r.triggerAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
                });
                const tgl = new Date(r.triggerAt).toLocaleDateString('id-ID', {
                    day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta'
                });

                text += `\n${toMono(`[${i + 1}]`)} 📌 ${toMono(r.message)}\n`;
                text += `     🕐 ${toMono(tgl + ' ' + jam + ' WIB')}`;
                if (timeLeft > 0) text += ` ${toMono('(' + formatDuration(timeLeft) + ' lagi)')}`;
                if (r.repeat) text += `\n     🔁 ${toMono(r.repeat)}`;
                text += '\n';
            });

            text += `\n${LINE}\n💡 ${toMono('.remind del [nomor]')} » ${toMono('hapus reminder')}`;

            return sock.sendMessage(from, { text }, { quoted: m });
        }

        // ── .remind del <nomor> ───────────────────────
        if (subCmd === 'del' || subCmd === 'hapus' || subCmd === 'delete') {
            const index = parseInt(args[1]);

            if (isNaN(index)) {
                return sock.sendMessage(from, {
                    text: `❌ ${toMono('Format salah!')}\n💡 ${toMono('.remind del 1')}`,
                }, { quoted: m.key ? m : undefined })
            }

            const success = deleteReminder(sender, index);

            if (!success) {
                return sock.sendMessage(from, {
                    text: `❌ ${toMono('Reminder nomor ' + index + ' tidak ditemukan.')}\n💡 ${toMono('.remind list')} » ${toMono('lihat daftar')}`,
                }, { quoted: m.key ? m : undefined })
            }

            return sock.sendMessage(from, {
                text:
                    `✅ ${toMono('Reminder #' + index + ' berhasil dihapus!')}\n` +
                    `${LINE}\n` +
                    `💡 ${toMono('.remind list')} » ${toMono('lihat sisa reminder')}`,
            }, { quoted: m.key ? m : undefined });
        }

        // ── .remind help ──────────────────────────────
        if (!subCmd || subCmd === 'help') {
            const text =
                `${toMono('cmd')} : ${toMono('.remind')}\n${LINE}\n\n` +
                `${toMono('Format Waktu:')}\n` +
                `  ⏱️  ${toMono('10m')}          » ${toMono('10 menit lagi')}\n` +
                `  ⏱️  ${toMono('2j / 2jam')}     » ${toMono('2 jam lagi')}\n` +
                `  ⏱️  ${toMono('1d / 1hari')}    » ${toMono('1 hari lagi')}\n` +
                `  🕐  ${toMono('08:30 / 08.30')} » ${toMono('jam 08.30 WIB')}\n` +
                `  🕐  ${toMono('besok 08:30')}   » ${toMono('besok jam 08.30 WIB')}\n` +
                `  🔁  ${toMono('08:30-daily')}   » ${toMono('setiap hari 08.30')}\n` +
                `  🔁  ${toMono('08:30-weekly')}  » ${toMono('setiap minggu')}\n\n` +
                `${toMono('Contoh:')}\n` +
                `  ${toMono('.remind 10menit Minum obat')}\n` +
                `  ${toMono('.remind 2jam Meeting klien')}\n` +
                `  ${toMono('.remind besok 08:30 Sholat dhuha')}\n` +
                `  ${toMono('.remind 08:30-daily Sholat subuh')}\n\n` +
                `${LINE}\n` +
                `💡 ${toMono('.remind list')}      » ${toMono('lihat semua')}\n` +
                `💡 ${toMono('.remind del 1')}     » ${toMono('hapus nomor 1')}`;

            return sock.sendMessage(from, { text }, { quoted: m });
        }

        // ── .remind <waktu> <pesan> ───────────────────
        // Gunakan smart parsing untuk extract time dan message
        const { timeStr, message, forceTomorrow } = smartParsing(args);

        if (!timeStr) {
            return sock.sendMessage(from, {
                text:
                    `❌ ${toMono('Format salah!')}\n\n` +
                    `${toMono('Format yang benar:')}\n` +
                    `${toMono('.remind 1m alasan (1 menit)')}\n` +
                    `${toMono('.remind 2h alasan (2 jam)')}\n` +
                    `${toMono('.remind 3d alasan (3 hari)')}\n` +
                    `${toMono('.remind 08:30 alasan (jam 08:30)')}\n\n` +
                    `💡 ${toMono('.remind help')} » ${toMono('lihat panduan lengkap')}`,
            }, { quoted: m.key ? m : undefined });
        }

        if (!message || message.length === 0) {
            return sock.sendMessage(from, {
                text:
                    `❌ ${toMono('Pesan reminder kosong!')}\n\n` +
                    `💡 ${toMono('.remind 10m Minum obat')}\n` +
                    `💡 ${toMono('.remind 2h Meeting klien')}\n` +
                    `💡 ${toMono('.remind help')} » ${toMono('lihat panduan')}`,
            }, { quoted: m.key ? m : undefined });
        }

        const parsed = parseTime(timeStr, forceTomorrow);

        if (!parsed) {
            return sock.sendMessage(from, {
                text:
                    `❌ ${toMono('Format waktu tidak dikenali: ' + timeStr)}\n\n` +
                    `💡 ${toMono('Contoh: 10m, 2h, 1d, 08:30, besok 08:30')}\n` +
                    `💡 ${toMono('.remind help')} » ${toMono('lihat panduan lengkap')}`,
            }, { quoted: m.key ? m : undefined });
        }

        const { triggerAt, repeat } = parsed;
        const id = addReminder({ sender, from, message, triggerAt, repeat });

        const jam = new Date(triggerAt).toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
        });
        const tgl = new Date(triggerAt).toLocaleDateString('id-ID', {
            weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Asia/Jakarta'
        });
        const sisaMs = triggerAt - Date.now();

        const text =
            `✅ ${toMono('Reminder berhasil dibuat!')}\n` +
            `${LINE}\n` +
            `📌 ${toMono(message)}\n` +
            `🕐 ${toMono(tgl + ', ' + jam + ' WIB')}\n` +
            `⏳ ${toMono(formatDuration(sisaMs) + ' lagi')}\n` +
            (repeat ? `🔁 ${toMono('Berulang: ' + repeat)}\n` : '') +
            `${LINE}\n` +
            `💡 ${toMono('.remind list')} » ${toMono('lihat semua reminder')}`;

        return sock.sendMessage(from, { text }, { quoted: m });
    }
};