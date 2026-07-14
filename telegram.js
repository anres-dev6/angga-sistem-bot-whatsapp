import "./env.js";
import { Telegraf } from "telegraf";
import { loadCommands, getCommand } from "./handler/command.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Telegram Bot
const token = process.env.TELEGRAM_TOKEN;
const ownerUsername = process.env.TELEGRAM_OWNER_USERNAME || "";

if (!token) {
    console.warn("⚠️ [Telegram] TELEGRAM_TOKEN is missing in the environment variables. Skipping Telegram bot activation.");
    process.exit(0);
}

const bot = new Telegraf(token);

// Load shared commands in this process on startup
console.log("[Telegram] Loading shared commands...");
await loadCommands(path.join(__dirname, "commands"));

// Register commands list in Telegram menu
try {
    const { commands } = await import("./handler/command.js");
    const botCommands = [];
    for (const [name, cmd] of commands.entries()) {
        // Telegram command names must be lowercase, 1-32 chars, matching: ^[a-z0-9_]+$
        if (/^[a-z0-9_]{1,32}$/.test(name)) {
            botCommands.push({
                command: name,
                description: cmd.description ? cmd.description.substring(0, 256) : `Jalankan perintah ${name}`
            });
        }
    }
    if (botCommands.length > 0) {
        await bot.telegram.setMyCommands(botCommands);
        console.log(`[Telegram] Registered ${botCommands.length} commands in Telegram menu.`);
    }
} catch (menuErr) {
    console.error("[Telegram] Failed to set bot commands menu:", menuErr);
}

// Handle text commands
bot.on("text", async (ctx) => {
    try {
        const body = ctx.message.text.trim();
        if (!body.startsWith("/")) return;

        const cmdName = body.slice(1).trim().split(" ")[0].toLowerCase();
        const args = body.trim().split(" ").slice(1);

        const command = getCommand(cmdName);
        if (!command) return;

        const from = ctx.chat.id.toString();
        const senderUsername = ctx.message.from.username || "";
        const isOwner = senderUsername.toLowerCase() === ownerUsername.toLowerCase();
        const isGroup = ctx.chat.type !== "private";

        // Access permission validation
        if (command.access?.owner && !isOwner) {
            return ctx.reply("❌ Perintah ini hanya dapat digunakan oleh Owner bot.");
        }

        // Mock Baileys sock to translate calls natively to Telegram
        const mockSock = {
            user: {
                id: bot.botInfo?.id ? `${bot.botInfo.id}:0@s.whatsapp.net` : "telegram-bot@s.whatsapp.net"
            },
            sendMessage: async (jid, content, options = {}) => {
                const chatId = jid;
                
                // 1. Text Message
                if (content.text) {
                    let text = content.text;
                    // Convert WhatsApp "." prefix hints to Telegram "/" prefix hints dynamically
                    text = text.replace(/(^|[^a-zA-Z0-9_])\.([a-zA-Z0-9_]+)/g, '$1/$2');
                    return ctx.reply(text);
                }

                // Helper to get media source payload for Telegram
                const getMediaSource = (media) => {
                    if (Buffer.isBuffer(media)) {
                        return { source: media };
                    }
                    if (media.url) {
                        return { url: media.url };
                    }
                    if (typeof media === "string") {
                        return { url: media };
                    }
                    return media;
                };

                // 2. Image Message
                if (content.image) {
                    const source = getMediaSource(content.image);
                    const caption = content.caption ? content.caption.replace(/(^|[^a-zA-Z0-9_])\.([a-zA-Z0-9_]+)/g, '$1/$2') : undefined;
                    return ctx.replyWithPhoto(source, { caption });
                }

                // 3. Video Message
                if (content.video) {
                    const source = getMediaSource(content.video);
                    const caption = content.caption ? content.caption.replace(/(^|[^a-zA-Z0-9_])\.([a-zA-Z0-9_]+)/g, '$1/$2') : undefined;
                    return ctx.replyWithVideo(source, { caption });
                }

                // 4. Document Message
                if (content.document) {
                    const source = getMediaSource(content.document);
                    const caption = content.caption ? content.caption.replace(/(^|[^a-zA-Z0-9_])\.([a-zA-Z0-9_]+)/g, '$1/$2') : undefined;
                    return ctx.replyWithDocument(source, { caption });
                }

                // 5. Reaction Message
                if (content.react) {
                    return ctx.reply(`Reaction: ${content.react.text}`);
                }
            }
        };

        // Mock Baileys message object
        const mockMsg = {
            key: {
                remoteJid: from,
                fromMe: false,
                id: ctx.message.message_id.toString()
            },
            pushName: ctx.message.from.first_name || "Telegram User",
            message: {
                conversation: body
            }
        };

        // Run the command
        console.log(`[Telegram] Command run: /${cmdName} from ${senderUsername}`);
        await command.run(mockSock, mockMsg, args, { isOwner, isGroup });

    } catch (err) {
        console.error("[Telegram] Error running command:", err);
        ctx.reply(`❌ Terjadi kesalahan saat menjalankan perintah: ${err.message || err}`);
    }
});

// Launch Bot
bot.launch().then(() => {
    console.log("🚀 [Telegram] Bot Telegram berhasil dijalankan!");
}).catch((err) => {
    console.error("❌ [Telegram] Gagal meluncurkan bot:", err);
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
