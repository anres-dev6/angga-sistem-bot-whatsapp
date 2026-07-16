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

    client.once('ready', () => {
        console.log(`🚀 [Discord] Bot Discord berhasil dijalankan sebagai ${client.user.tag}!`);
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return; // Ignore DMs for music commands

        const allowedPrefixes = ['!', '/'];
        const prefixUsed = allowedPrefixes.find(p => message.content.startsWith(p));
        if (!prefixUsed) return;

        const args = message.content.slice(prefixUsed.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Find command by name or aliases
        const command = client.commands.get(commandName) || 
                        client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        try {
            console.log(`[Discord] Command run: ${prefixUsed}${commandName} by ${message.author.tag} in ${message.guild.name}`);
            await command.run(client, message, args, client.queue);
        } catch (error) {
            console.error(`[Discord] Error executing command ${commandName}:`, error);
            message.reply('❌ Terjadi kesalahan saat menjalankan perintah tersebut!');
        }
    });

    // Listen for Button Interactions (Music Controls)
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
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
    });

    // Login to Discord
    client.login(token).catch(err => {
        console.error("❌ [Discord] Gagal login ke Discord:", err.message);
    });
}
