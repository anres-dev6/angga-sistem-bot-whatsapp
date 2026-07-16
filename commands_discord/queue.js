export default {
    name: 'queue',
    aliases: ['q', 'list'],
    description: 'Menampilkan antrean lagu saat ini',
    run: async (client, message, args, queue) => {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue || serverQueue.songs.length === 0) {
            return message.reply('❌ Antrean lagu kosong!');
        }

        let qText = `📋 *Antrean Lagu saat ini:* \n\n`;
        serverQueue.songs.forEach((song, index) => {
            if (index === 0) {
                qText += `▶️ *Sekarang diputar:* **${song.title}** (${song.duration})\n`;
            } else {
                qText += `${index}. **${song.title}** (${song.duration})\n`;
            }
        });

        return message.reply(qText);
    }
};
