export default {
    name: 'skip',
    aliases: ['s', 'next'],
    description: 'Melewati lagu saat ini',
    run: async (client, message, args, queue) => {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Anda harus bergabung ke voice channel!');

        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Tidak ada lagu yang sedang diputar!');

        serverQueue.player.stop();
        return message.reply('⏭️ Lagu dilewati.');
    }
};
