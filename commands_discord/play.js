import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import play from 'play-dl';
import fetch from 'node-fetch';

function formatSec(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 
        ? `${h}j ${m}m ${s}s` 
        : `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatMs(ms) {
    return formatSec(Math.floor(ms / 1000));
}

export default {
    name: 'play',
    aliases: ['p'],
    description: 'Memutar lagu dari YouTube/SoundCloud/Spotify di Voice Channel',
    run: async (client, message, args, queue) => {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Anda harus bergabung ke voice channel terlebih dahulu!');
        }

        const query = args.join(' ');
        if (!query) {
            return message.reply('❌ Masukkan judul lagu atau link (YouTube/Spotify/SoundCloud)!');
        }

        let songsToAdd = [];
        let isPlaylist = false;
        let playlistName = '';
        let totalDurationStr = '';

        const ytValidate = play.yt_validate(query);

        // 1. Handle Spotify Links
        const isSpotifyLink = query.includes('spotify.com') && play.sp_validate(query);
        if (isSpotifyLink) {
            const hasKeys = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
            const isTrack = query.includes('/track/');

            // Keyless flow for single tracks
            if (isTrack && !hasKeys) {
                try {
                    console.log(`[Spotify Loader] Keyless lookup for single track: ${query}`);
                    const apiUrl = `https://api.siputzx.my.id/api/d/spotifyv2?url=${encodeURIComponent(query)}`;
                    const response = await fetch(apiUrl);
                    if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
                    
                    const data = await response.json();
                    if (data.status && data.data && data.data.download) {
                        songsToAdd.push({
                            title: `${data.data.title} - ${data.data.artist || 'Spotify'}`,
                            url: data.data.download,
                            duration: 'Unknown',
                            source: 'spotify',
                            resolved: true
                        });
                    } else {
                        throw new Error('API returned invalid/empty download link');
                    }
                } catch (err) {
                    console.error('[Spotify Loader] Keyless lookup failed:', err.message);
                    return message.reply('❌ Gagal memuat metadata Spotify. Pastikan link track Spotify Anda valid atau atur `SPOTIFY_CLIENT_ID` & `SPOTIFY_CLIENT_SECRET` di Railway.');
                }
            } 
            // Credential-based flow (playlists/albums or fallback single tracks)
            else {
                if (!hasKeys) {
                    return message.reply('❌ Untuk memutar **Playlist/Album Spotify**, Anda wajib mendaftarkan Client ID & Client Secret di Railway/Environment Variables sebagai `SPOTIFY_CLIENT_ID` dan `SPOTIFY_CLIENT_SECRET`!');
                }

                try {
                    const spData = await play.spotify(query);
                    
                    if (spData.type === 'track') {
                        const searchResult = await play.search(`${spData.name} ${spData.artists.map(a => a.name).join(' ')}`, { limit: 1 });
                        if (searchResult.length > 0) {
                            songsToAdd.push({
                                title: spData.name,
                                url: searchResult[0].url,
                                duration: searchResult[0].durationRaw || formatMs(spData.duration_ms),
                                source: 'spotify',
                                resolved: true
                            });
                        }
                    } else if (spData.type === 'playlist' || spData.type === 'album') {
                        isPlaylist = true;
                        playlistName = spData.name;
                        const tracks = spData.tracks.items || spData.tracks;
                        
                        const totalMs = tracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
                        totalDurationStr = formatMs(totalMs);

                        tracks.forEach(track => {
                            songsToAdd.push({
                                title: track.name,
                                artist: track.artists ? track.artists.map(a => a.name).join(' ') : '',
                                url: null,
                                duration: formatMs(track.duration_ms),
                                source: 'spotify',
                                resolved: false
                            });
                        });
                    }
                } catch (err) {
                    console.error('[Spotify Loader] Error with credentials:', err);
                    return message.reply('❌ Gagal memuat data dari Spotify menggunakan API key.');
                }
            }
        }
        // 2. Handle YouTube Playlists
        else if (ytValidate === 'playlist') {
            try {
                isPlaylist = true;
                const playlistInfo = await play.playlist_info(query);
                playlistName = playlistInfo.title;
                
                const videos = await playlistInfo.all_videos();
                const totalSec = videos.reduce((acc, v) => acc + (v.durationInSec || 0), 0);
                totalDurationStr = formatSec(totalSec);

                videos.forEach(v => {
                    songsToAdd.push({
                        title: v.title,
                        url: v.url,
                        duration: v.durationRaw || formatSec(v.durationInSec),
                        source: 'youtube',
                        resolved: true
                    });
                });
            } catch (err) {
                console.error('[YT Playlist Loader] Error:', err);
                return message.reply('❌ Gagal memuat Playlist YouTube.');
            }
        }
        // 3. Handle Single Search / Video JID
        else {
            try {
                if (query.startsWith('http')) {
                    const info = await play.video_info(query);
                    songsToAdd.push({
                        title: info.video_details.title,
                        url: info.video_details.url,
                        duration: info.video_details.durationRaw || formatSec(info.video_details.durationInSec),
                        source: 'youtube',
                        resolved: true
                    });
                } else {
                    const searchResult = await play.search(query, { limit: 1 });
                    if (searchResult.length === 0) {
                        return message.reply('❌ Lagu tidak ditemukan.');
                    }
                    songsToAdd.push({
                        title: searchResult[0].title,
                        url: searchResult[0].url,
                        duration: searchResult[0].durationRaw || formatSec(searchResult[0].durationInSec),
                        source: 'youtube',
                        resolved: true
                    });
                }
            } catch (err) {
                console.error('[Play DL Search] Error:', err);
                return message.reply('❌ Gagal mencari lagu.');
            }
        }

        if (songsToAdd.length === 0) {
            return message.reply('❌ Gagal mendapatkan informasi lagu.');
        }

        const serverQueue = queue.get(message.guild.id);

        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                player: createAudioPlayer(),
                songs: songsToAdd,
                volume: 0.5,
                playing: true,
                audioResource: null
            };

            queue.set(message.guild.id, queueConstruct);

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });
                
                queueConstruct.connection = connection;
                connection.subscribe(queueConstruct.player);

                playSong(message.guild.id, queueConstruct.songs[0], queue);

                if (isPlaylist) {
                    message.reply(`🎶 Memulai pemutaran playlist: **${playlistName}**\n📦 Total: **${songsToAdd.length} lagu** (Durasi: *${totalDurationStr}*)`);
                } else {
                    message.reply(`🎶 Mulai memutar: **${songsToAdd[0].title}** (Durasi: *${songsToAdd[0].duration}*)`);
                }
            } catch (err) {
                console.error(err);
                queue.delete(message.guild.id);
                return message.reply('❌ Gagal bergabung ke Voice Channel.');
            }
        } else {
            serverQueue.songs.push(...songsToAdd);
            if (isPlaylist) {
                return message.reply(`✅ Berhasil menambahkan playlist: **${playlistName}**\n📦 Total: **${songsToAdd.length} lagu** (Durasi: *${totalDurationStr}*) ke antrean.`);
            } else {
                return message.reply(`✅ Ditambahkan ke antrean: **${songsToAdd[0].title}** (Durasi: *${songsToAdd[0].duration}*)`);
            }
        }
    }
};

async function playSong(guildId, song, queueMap) {
    const serverQueue = queueMap.get(guildId);
    if (!song) {
        setTimeout(() => {
            const currentQueue = queueMap.get(guildId);
            if (currentQueue && currentQueue.songs.length === 0) {
                try {
                    currentQueue.connection.destroy();
                } catch {}
                queueMap.delete(guildId);
                currentQueue.textChannel.send('👋 Meninggalkan Voice Channel karena antrean kosong.');
            }
        }, 10000);
        return;
    }

    try {
        // Resolve Spotify placeholder to YouTube stream url on-the-fly right before playing
        if (!song.resolved) {
            console.log(`[Audio Playback] Resolving Spotify track JIT: ${song.title} ${song.artist || ''}`);
            const searchResult = await play.search(`${song.title} ${song.artist || ''}`, { limit: 1 });
            if (searchResult.length > 0) {
                song.url = searchResult[0].url;
                song.resolved = true;
            } else {
                serverQueue.textChannel.send(`⚠️ Gagal mencari versi audio untuk: **${song.title}** (Lagu dilewati).`);
                serverQueue.songs.shift();
                return playSong(guildId, serverQueue.songs[0], queueMap);
            }
        }

        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true
        });
        
        resource.volume.setVolume(serverQueue.volume);
        serverQueue.audioResource = resource;
        serverQueue.player.play(resource);

        // Get thumbnail for the embed
        let thumbnail = null;
        if (song.url) {
            const videoId = song.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
            if (videoId) {
                thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🎶 Sekarang Diputar')
            .setDescription(`**${song.title}**`)
            .setColor('#5865F2')
            .addFields(
                { name: '⏱️ Durasi', value: `${song.duration}`, inline: true },
                { name: '🎵 Sumber', value: `${song.source.toUpperCase()}`, inline: true }
            );

        if (thumbnail) {
            embed.setThumbnail(thumbnail);
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_pause_resume')
                    .setEmoji('⏯️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('music_vol_down')
                    .setEmoji('🔉')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_vol_up')
                    .setEmoji('🔊')
                    .setStyle(ButtonStyle.Secondary)
            );

        serverQueue.textChannel.send({ embeds: [embed], components: [row] });

        // Track when song finishes
        serverQueue.player.once(AudioPlayerStatus.Idle, () => {
            serverQueue.songs.shift();
            playSong(guildId, serverQueue.songs[0], queueMap);
        });

        serverQueue.player.on('error', error => {
            console.error(`Audio player error: ${error.message}`);
            serverQueue.textChannel.send(`⚠️ Terjadi kesalahan saat memutar lagu: ${error.message}`);
            serverQueue.songs.shift();
            playSong(guildId, serverQueue.songs[0], queueMap);
        });

    } catch (err) {
        console.error('[Audio Playback] Error:', err);
        serverQueue.textChannel.send(`❌ Gagal memutar lagu **${song.title}**: ${err.message}`);
        serverQueue.songs.shift();
        playSong(guildId, serverQueue.songs[0], queueMap);
    }
}
