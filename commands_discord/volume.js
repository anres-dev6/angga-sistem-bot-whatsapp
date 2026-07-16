export default {
    name: 'volume',
    aliases: ['vol', 'v'],
    description: 'Mengatur volume suara (1-100)',
    run: async (client, message, args, queue) => {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Anda harus bergabung ke voice channel!');

        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Tidak ada lagu yang sedang diputar!');

        const volArg = args[0];
        if (!volArg) {
            return message.reply(`🔊 Volume saat ini: **${serverQueue.volume * 100}%**`);
        }

        const vol = parseInt(volArg);
        if (isNaN(vol) || vol < 1 || vol > 100) {
            return message.reply('❌ Volume harus berupa angka dari 1 sampai 100!');
        }

        const targetVolume = vol / 100;
        serverQueue.volume = targetVolume;
        if (serverQueue.audioResource && serverQueue.audioResource.volume) {
            serverQueue.audioResource.volume.setVolume(targetVolume);
        }

        return message.reply(`🔊 Volume berhasil diubah ke: **${vol}%**`);
    }
};
