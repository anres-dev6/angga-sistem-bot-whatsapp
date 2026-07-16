import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import play from 'play-dl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.DISCORD_TOKEN || "";
const prefix = "!";

if (!token) {
    console.warn("⚠️ [Discord] DISCORD_TOKEN is missing in the environment variables. Skipping Discord bot activation.");
} else {
    console.log("[Discord] Activating Discord bot connector...");

    // Setup Spotify authorization if available
    const spotifyId = process.env.SPOTIFY_CLIENT_ID;
    const spotifySecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (spotifyId && spotifySecret) {
        try {
            play.setToken({
                spotify: {
                    client_id: spotifyId,
                    client_secret: spotifySecret
                }
            });
            console.log("[Discord] Authorized Spotify API successfully!");
        } catch (spErr) {
            console.error("[Discord] Failed to set Spotify token:", spErr.message);
        }
    } else {
        console.warn("⚠️ [Discord] SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing. Spotify Playlists won't be supported keylessly, but single tracks will use public API fallback.");
    }

    // Setup YouTube cookies if available
    const ytCookie = process.env.YOUTUBE_COOKIE;
    if (ytCookie) {
        try {
            play.setToken({
                youtube: {
                    cookie: ytCookie
                }
            });
            console.log("[Discord] Loaded YouTube cookies successfully!");
        } catch (ytErr) {
            console.error("[Discord] Failed to set YouTube cookies:", ytErr.message);
        }
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    global.tgBot = global.tgBot || null; // Ensure globals are initialized
    global.waSock = global.waSock || null;
    global.discordClient = client; // Expose client globally

    client.commands = new Collection();
    client.queue = new Map(); // Global music queue per guild on client object

    // Load Discord Commands
    const commandsPath = path.join(__dirname, 'commands_discord');
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            import(`file://${filePath}`).then(command => {
                if (command.default && command.default.name) {
                    client.commands.set(command.default.name, command.default);
                    console.log(`[Discord] Loaded command: ${command.default.name}`);
                }
            }).catch(err => {
                console.error(`[Discord] Failed to load command file ${file}:`, err);
            });
        }
    }

    const slashCommands = [
        {
            name: 'play',
            description: 'Memutar lagu dari YouTube/SoundCloud/Spotify di Voice Channel',
            options: [
                {
                    name: 'query',
                    description: 'Judul lagu atau link (YouTube/Spotify/SoundCloud)',
                    type: 3, // STRING
                    required: true
                }
            ]
        },
        {
            name: 'skip',
            description: 'Melewati lagu yang sedang diputar ke antrean berikutnya'
        },
        {
            name: 'stop',
            description: 'Menghentikan lagu, menghapus antrean, dan keluar dari voice channel'
        },
        {
            name: 'queue',
            description: 'Menampilkan daftar antrean lagu saat ini'
        },
        {
            name: 'volume',
            description: 'Mengatur volume suara (1-100)',
            options: [
                {
                    name: 'jumlah',
                    description: 'Tingkat volume dari 1 hingga 100',
                    type: 4, // INTEGER
                    required: false
                }
            ]
        }
    ];

    client.once('ready', async () => {
        console.log(`🚀 [Discord] Bot Discord berhasil dijalankan sebagai ${client.user.tag}!`);
        try {
            await client.application.commands.set(slashCommands);
            console.log('[Discord] Registered Slash Commands successfully!');
        } catch (err) {
            console.error('[Discord] Failed to register slash commands:', err);
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return; // Ignore DMs for music commands

        const allowedPrefixes = ['!', '/'];
        const prefixUsed = allowedPrefixes.find(p => message.content.startsWith(p));
        if (!prefixUsed) return;

        // If it starts with / but matches a registered slash command, ignore it in messageCreate
        // to avoid double triggering if the user triggers a real slash command in client
        const args = message.content.slice(prefixUsed.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // If prefix is / and the command name matches one of the slash commands, skip text trigger
        if (prefixUsed === '/' && ['play', 'skip', 'stop', 'queue', 'volume'].includes(commandName)) {
            return;
        }

        // Find command by name or aliases
        const command = client.commands.get(commandName) || 
                        client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        try {
            console.log(`[Discord Message] Command run: ${prefixUsed}${commandName} by ${message.author.tag} in ${message.guild.name}`);
            await command.run(client, message, args, client.queue);
        } catch (error) {
            console.error(`[Discord Message] Error executing command ${commandName}:`, error);
            message.reply('❌ Terjadi kesalahan saat menjalankan perintah tersebut!');
        }
    });

    // Listen for interactions (Slash Commands & Button Controls)
    client.on('interactionCreate', async (interaction) => {
        // 1. Handle Slash Commands
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            const command = client.commands.get(commandName);
            if (!command) return;

            // Check voice channel
            const voiceChannel = interaction.member.voice.channel;
            if (commandName === 'play' && !voiceChannel) {
                return interaction.reply({ content: '❌ Anda harus bergabung ke voice channel terlebih dahulu!', ephemeral: true });
            }

            let args = [];
            if (commandName === 'play') {
                const query = interaction.options.getString('query');
                args = [query];
            } else if (commandName === 'volume') {
                const vol = interaction.options.getInteger('jumlah');
                if (vol !== null) args = [vol.toString()];
            }

            // Mock message object to reuse command module code
            const mockMessage = {
                guild: interaction.guild,
                member: interaction.member,
                channel: interaction.channel,
                reply: async (content) => {
                    const cleanContent = typeof content === 'object' && content.text ? content.text : content;
                    if (interaction.deferred || interaction.replied) {
                        return interaction.followUp(cleanContent);
                    }
                    return interaction.reply(cleanContent);
                }
            };

            try {
                if (commandName === 'play') {
                    // Defer reply because searching takes time
                    await interaction.deferReply();
                    mockMessage.reply = async (content) => {
                        const cleanContent = typeof content === 'object' && content.text ? content.text : content;
                        return interaction.editReply(cleanContent);
                    };
                }
                console.log(`[Discord Slash] Command run: /${commandName} by ${interaction.user.tag} in ${interaction.guild.name}`);
                await command.run(client, mockMessage, args, client.queue);
            } catch (err) {
                console.error(`[Discord Slash Command] Error running ${commandName}:`, err);
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ content: '❌ Terjadi kesalahan saat menjalankan command.', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Terjadi kesalahan saat menjalankan command.', ephemeral: true });
                }
            }
            return;
        }

        // 2. Handle Button Interactions
        if (interaction.isButton()) {
            if (!interaction.customId.startsWith('music_')) return;

            const serverQueue = client.queue.get(interaction.guildId);
            if (!serverQueue) {
                return interaction.reply({ content: '❌ Tidak ada musik yang sedang diputar!', ephemeral: true });
            }

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel || voiceChannel.id !== serverQueue.voiceChannel.id) {
                return interaction.reply({ content: '❌ Anda harus berada di voice channel yang sama dengan bot untuk menggunakan tombol!', ephemeral: true });
            }

            try {
                switch (interaction.customId) {
                    case 'music_pause_resume':
                        if (serverQueue.player.state.status === 'paused') {
                            serverQueue.player.unpause();
                            await interaction.reply({ content: '▶️ Musik dilanjutkan!', ephemeral: true });
                        } else {
                            serverQueue.player.pause();
                            await interaction.reply({ content: '⏸️ Musik dijeda!', ephemeral: true });
                        }
                        break;
                    case 'music_skip':
                        serverQueue.player.stop();
                        await interaction.reply({ content: '⏭️ Lagu dilewati!', ephemeral: true });
                        break;
                    case 'music_stop':
                        serverQueue.songs = [];
                        serverQueue.player.stop();
                        if (serverQueue.connection) {
                            try { serverQueue.connection.destroy(); } catch {}
                        }
                        client.queue.delete(interaction.guildId);
                        await interaction.reply({ content: '⏹️ Pemutaran musik dihentikan dan bot keluar!', ephemeral: true });
                        break;
                    case 'music_vol_down':
                        serverQueue.volume = Math.max(0.1, serverQueue.volume - 0.1);
                        if (serverQueue.audioResource && serverQueue.audioResource.volume) {
                            serverQueue.audioResource.volume.setVolume(serverQueue.volume);
                        }
                        await interaction.reply({ content: `🔉 Volume diturunkan ke: **${Math.round(serverQueue.volume * 100)}%**`, ephemeral: true });
                        break;
                    case 'music_vol_up':
                        serverQueue.volume = Math.min(1.0, serverQueue.volume + 0.1);
                        if (serverQueue.audioResource && serverQueue.audioResource.volume) {
                            serverQueue.audioResource.volume.setVolume(serverQueue.volume);
                        }
                        await interaction.reply({ content: `🔊 Volume dinaikkan ke: **${Math.round(serverQueue.volume * 100)}%**`, ephemeral: true });
                        break;
                    default:
                        await interaction.reply({ content: '❌ Perintah tidak dikenal.', ephemeral: true });
                }
            } catch (err) {
                console.error('[Discord Button Interaction] Error:', err);
                try {
                    await interaction.reply({ content: '❌ Terjadi kesalahan saat memproses tombol.', ephemeral: true });
                } catch {}
            }
        }
    });

    // Login to Discord
    client.login(token).catch(err => {
        console.error("❌ [Discord] Gagal login ke Discord:", err.message);
    });
}
