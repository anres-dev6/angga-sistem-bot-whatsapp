import { performance } from 'perf_hooks';

export default {
    name: 'runtime',
    aliases: ['runtime', 'uptime', 'ping'],
    tags: ['utility'],
    description: 'Menampilkan informasi status dan waktu aktif bot',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;

        // 1. Calculate Uptime
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / (3600 * 24));
        const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        let runtimeParts = [];
        if (days > 0) runtimeParts.push(`${days} Hari`);
        if (hours > 0) runtimeParts.push(`${hours} Jam`);
        if (minutes > 0) runtimeParts.push(`${minutes} Menit`);
        runtimeParts.push(`${seconds} Detik`);

        const runtimeStr = runtimeParts.join(' ');

        // 2. Calculate Response Speed (Ping Latency)
        let latency = '0.000';
        if (msg.messageTimestamp) {
            // msg.messageTimestamp is in seconds
            const timeDiff = Date.now() - (msg.messageTimestamp * 1000);
            const rawLatency = timeDiff / 1000;
            // Handle clock skew if negative
            latency = rawLatency < 0 ? '0.001' : rawLatency.toFixed(3);
        }

        const statusMsg = `🟢 *STATUS BOT*

⏱ *Runtime:* ${runtimeStr}
🚀 *Status:* Online
⚡ *Speed:* ${latency} Detik`;

        return sock.sendMessage(from, { text: statusMsg }, { quoted: msg });
    }
};
