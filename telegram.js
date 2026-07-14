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

// Handle text commands
bot.on("text", async (ctx) => {
    try {
        const body = ctx.message.text.trim();
        if (!body.startsWith(".")) return;

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
                    return ctx.reply(content.text);
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
                    return ctx.replyWithPhoto(source, { caption: content.caption });
                }

                // 3. Video Message
                if (content.video) {
                    const source = getMediaSource(content.video);
                    return ctx.replyWithVideo(source, { caption: content.caption });
                }

                // 4. Document Message
                if (content.document) {
                    const source = getMediaSource(content.document);
                    return ctx.replyWithDocument(source, { caption: content.caption });
                }

                // 5. Reaction Message
                if (content.react) {
                    // Send as text reaction or small text emoji reply
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
        console.log(`[Telegram] Command run: .${cmdName} from ${senderUsername}`);
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
