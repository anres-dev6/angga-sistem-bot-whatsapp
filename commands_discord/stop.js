export default {
    name: 'stop',
    aliases: ['leave', 'dc', 'disconnect'],
    description: 'Menghentikan lagu dan keluar dari voice channel',
    run: async (client, message, args, queue) => {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Anda harus bergabung ke voice channel!');

        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) {
            // Destroy connection directly if it exists
            const { getVoiceConnection } = await import('@discordjs/voice');
            const connection = getVoiceConnection(message.guild.id);
            if (connection) {
                try {
                    connection.destroy();
                } catch {}
                return message.reply('👋 Meninggalkan Voice Channel.');
            }
            return message.reply('❌ Bot tidak ada di voice channel!');
        }

        serverQueue.songs = [];
        serverQueue.player.stop();
        if (serverQueue.connection) {
            try {
                serverQueue.connection.destroy();
            } catch {}
        }
        queue.delete(message.guild.id);
        return message.reply('⏹️ Pemutaran musik dihentikan dan bot meninggalkan voice channel.');
    }
};
