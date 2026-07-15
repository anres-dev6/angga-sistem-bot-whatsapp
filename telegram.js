import { Telegraf } from "telegraf";
import { loadCommands, getCommand, commands } from "./handler/command.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ownerUsername = process.env.TELEGRAM_OWNER_USERNAME || "";

/**
 * Factory function to create a mock Baileys socket wrapper mapping calls to Telegram
 * @param {object} ctx - Telegram Context
 */
function createMockSock(ctx, botInfo) {
    return {
        user: {
            id: botInfo?.id ? `${botInfo.id}:0@s.whatsapp.net` : "telegram-bot@s.whatsapp.net"
        },
        sendMessage: async (jid, content, options = {}) => {
            // 1. Text Message
            if (content.text) {
                let text = content.text;
                // Convert WhatsApp "." prefix hints to Telegram "/" prefix hints dynamically
                text = text.replace(/(^|[^a-zA-Z0-9_])\.([a-zA-Z0-9_]+)/g, '$1/$2');
                return ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => ctx.reply(text));
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
                return ctx.replyWithPhoto(source, { caption, parse_mode: 'Markdown' }).catch(() => ctx.replyWithPhoto(source, { caption }));
            }

            // 3. Video Message
            if (content.video) {
                const source = getMediaSource(content.video);
                const caption = content.caption ? content.caption.replace(/(^|[^a-zA-Z0-9_])\.([a-zA-Z0-9_]+)/g, '$1/$2') : undefined;
                return ctx.replyWithVideo(source, { caption, parse_mode: 'Markdown' }).catch(() => ctx.replyWithVideo(source, { caption }));
            }

            // 4. Document Message
            if (content.document) {
                const source = getMediaSource(content.document);
                const caption = content.caption ? content.caption.replace(/(^|[^a-zA-Z0-9_])\.([a-zA-Z0-9_]+)/g, '$1/$2') : undefined;
                return ctx.replyWithDocument(source, { caption, parse_mode: 'Markdown' }).catch(() => ctx.replyWithDocument(source, { caption }));
            }

            // 5. Reaction Message
            if (content.react) {
                // Ignore reaction messages on Telegram to keep the chat clean
                return;
            }
        },
        relayMessage: async (jid, message, options = {}) => {
            let text = "";
            let buttons = [];

            // Extract content and buttons from Baileys message structure
            if (message.viewOnceMessage?.message?.interactiveMessage) {
                const interactive = message.viewOnceMessage.message.interactiveMessage;
                text = interactive.body?.text || "";
                buttons = interactive.nativeFlowMessage?.buttons || [];
            } else if (message.conversation) {
                text = message.conversation;
            } else if (message.extendedTextMessage?.text) {
                text = message.extendedTextMessage.text;
            } else if (message.protocolMessage?.editedMessage?.conversation) {
                text = message.protocolMessage.editedMessage.conversation;
            } else if (message.protocolMessage?.editedMessage?.extendedTextMessage?.text) {
                text = message.protocolMessage.editedMessage.extendedTextMessage.text;
            } else if (message.protocolMessage?.editedMessage?.viewOnceMessage?.message?.interactiveMessage) {
                const interactive = message.protocolMessage.editedMessage.viewOnceMessage.message.interactiveMessage;
                text = interactive.body?.text || "";
                buttons = interactive.nativeFlowMessage?.buttons || [];
            }

            if (text) {
                // Map Baileys quick_reply buttons to Telegram inline keyboard format
                const inlineKeyboard = [];
                const row = [];
                for (const btn of buttons) {
                    if (btn.buttonParamsJson) {
                        try {
                            const params = JSON.parse(btn.buttonParamsJson);
                            if (params.display_text && params.id) {
                                row.push({
                                    text: params.display_text,
                                    callback_data: params.id
                                });
                            }
                        } catch {}
                    }
                }
                
                // Format layout neatly
                if (row.length > 0) {
                    if (row.length <= 5) {
                        inlineKeyboard.push(row);
                    } else {
                        // Split into rows of max 5 buttons
                        inlineKeyboard.push(row.slice(0, 5));
                        inlineKeyboard.push(row.slice(5));
                    }
                }

                const telegramOptions = { parse_mode: 'Markdown' };
                if (inlineKeyboard.length > 0) {
                    telegramOptions.reply_markup = { inline_keyboard: inlineKeyboard };
                }

                // Handle editing (protocolMessage)
                if (message.protocolMessage) {
                    try {
                        return await ctx.editMessageText(text, telegramOptions);
                    } catch (editErr) {
                        console.log("[Telegram] editMessageText failed, falling back to new reply:", editErr.message);
                        return await ctx.reply(text, telegramOptions).catch(() => ctx.reply(text));
                    }
                }

                return await ctx.reply(text, telegramOptions).catch(() => ctx.reply(text));
            }
        },
        groupMetadata: async (jid) => {
            const chatId = parseInt(jid);
            if (isNaN(chatId)) return { participants: [] };

            try {
                // Fetch group administrators in Telegram
                const admins = await ctx.getChatAdministrators();
                const participants = admins.map(admin => ({
                    id: admin.user.id.toString() + "@s.whatsapp.net",
                    admin: admin.status === 'creator' ? 'superadmin' : 'admin'
                }));

                // Add sender if not in admin list (as non-admin member)
                const senderId = ctx.message?.from?.id?.toString() + "@s.whatsapp.net";
                if (!participants.some(p => p.id === senderId)) {
                    participants.push({ id: senderId, admin: null });
                }
                return { participants };
            } catch (err) {
                console.error("[Telegram Admin] Failed to fetch chat admins:", err.message);
                return { participants: [] };
            }
        },
        groupParticipantsUpdate: async (jid, participants, action) => {
            const chatId = parseInt(jid);
            if (isNaN(chatId)) return;

            for (const participant of participants) {
                const cleanIdStr = participant.split('@')[0];
                const userId = parseInt(cleanIdStr);
                if (isNaN(userId)) continue;

                try {
                    if (action === 'remove') {
                        // Ban / Kick user on Telegram
                        await ctx.banChatMember(userId);
                        console.log(`[Telegram Admin] Successfully banned user ${userId} in chat ${chatId}`);
                    } else if (action === 'add') {
                        // Unban user on Telegram
                        await ctx.unbanChatMember(userId);
                        console.log(`[Telegram Admin] Successfully unbanned user ${userId} in chat ${chatId}`);
                    } else if (action === 'promote') {
                        // Promote user to admin on Telegram with standard admin powers
                        await ctx.promoteChatMember(userId, {
                            can_change_info: true,
                            can_post_messages: true,
                            can_edit_messages: true,
                            can_delete_messages: true,
                            can_invite_users: true,
                            can_restrict_members: true,
                            can_pin_messages: true,
                            can_promote_members: false
                        });
                        console.log(`[Telegram Admin] Successfully promoted user ${userId} in chat ${chatId}`);
                    } else if (action === 'demote') {
                        // Demote user (strip admin rights) on Telegram
                        await ctx.promoteChatMember(userId, {
                            can_change_info: false,
                            can_post_messages: false,
                            can_edit_messages: false,
                            can_delete_messages: false,
                            can_invite_users: false,
                            can_restrict_members: false,
                            can_pin_messages: false,
                            can_promote_members: false
                        });
                        console.log(`[Telegram Admin] Successfully demoted user ${userId} in chat ${chatId}`);
                    }
                } catch (err) {
                    console.error(`[Telegram Admin] Action '${action}' failed for user ${userId}:`, err.message);
                    throw err;
                }
            }
        },
        deleteMessage: async (jid, key) => {
            const messageId = parseInt(key.id);
            if (!isNaN(messageId)) {
                await ctx.deleteMessage(messageId).catch(err => {
                    console.error("[Telegram Admin] Failed to delete message:", err.message);
                    throw err;
                });
            }
        }
    };
}

if (!token) {
    console.warn("⚠️ [Telegram] TELEGRAM_TOKEN or TELEGRAM_BOT_TOKEN is missing in the environment variables. Skipping Telegram bot activation.");
} else {
    console.log("[Telegram] Activating Telegram bot connector...");
    const bot = new Telegraf(token);

    // Load shared commands if they haven't been loaded already
    if (commands.size === 0) {
        console.log("[Telegram] Commands map is empty. Loading shared commands...");
        await loadCommands(path.join(__dirname, "commands"));
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
            if (command.access?.group && !isGroup) {
                return ctx.reply("❌ Perintah ini hanya dapat digunakan di dalam grup.");
            }
            if (command.access?.private && isGroup) {
                return ctx.reply("❌ Perintah ini hanya dapat digunakan di chat pribadi (private chat).");
            }

            const mockSock = createMockSock(ctx, bot.botInfo);

            // Mock Baileys message object with contextual reply support
            const mockMsg = {
                key: {
                    remoteJid: from,
                    fromMe: false,
                    id: ctx.message.message_id.toString(),
                    participant: ctx.message.from.id.toString() + "@s.whatsapp.net"
                },
                pushName: ctx.message.from.first_name || "Telegram User",
                message: {
                    extendedTextMessage: {
                        text: body,
                        contextInfo: ctx.message.reply_to_message ? {
                            stanzaId: ctx.message.reply_to_message.message_id.toString(),
                            participant: ctx.message.reply_to_message.from.id.toString() + "@s.whatsapp.net",
                            quotedMessage: {
                                conversation: ctx.message.reply_to_message.text || ""
                            }
                        } : undefined
                    }
                }
            };

            // Run the command
            console.log(`[Telegram] Command run: /${cmdName} from ${senderUsername}`);
            await command.run(mockSock, mockMsg, args, { 
                sender: ctx.message.from.id.toString() + "@s.whatsapp.net", 
                isOwner, 
                isGroup 
            });

        } catch (err) {
            console.error("[Telegram] Error running command:", err);
            ctx.reply(`❌ Terjadi kesalahan saat menjalankan perintah: ${err.message || err}`);
        }
    });

    // Handle callback query events (Interactive inline button clicks)
    bot.on("callback_query", async (ctx) => {
        try {
            const selectedId = ctx.callbackQuery.data;
            if (!selectedId) return;

            const from = ctx.chat.id.toString();
            const mockSock = createMockSock(ctx, bot.botInfo);

            // Mock Baileys message object for button response
            const mockMsg = {
                key: {
                    remoteJid: from,
                    fromMe: false,
                    id: ctx.callbackQuery.message.message_id.toString()
                },
                pushName: ctx.callbackQuery.from.first_name || "Telegram User",
                message: {
                    interactiveResponseMessage: {
                        contextInfo: {
                            stanzaId: ctx.callbackQuery.message.message_id.toString()
                        },
                        nativeFlowResponseMessage: {
                            paramsJson: JSON.stringify({ id: selectedId })
                        }
                    }
                }
            };

            // 1. Wikipedia button responses
            if (selectedId.startsWith('wiki_')) {
                console.log(`[Telegram Callback] Routing wiki click: ${selectedId}`);
                const { handleWikiButton } = await import('./utils/wikiHelper.js');
                await handleWikiButton(mockSock, mockMsg, selectedId);
                await ctx.answerCbQuery().catch(() => {});
                return;
            }

            // 2. AutoDL interactive button responses
            if (selectedId.startsWith('iadl_')) {
                console.log(`[Telegram Callback] Routing AutoDL click: ${selectedId}`);
                const { handleInteractiveResponse } = await import('./utils/interactiveAutoDL.js');
                await handleInteractiveResponse(mockSock, mockMsg);
                await ctx.answerCbQuery().catch(() => {});
                return;
            }

            await ctx.answerCbQuery("Perintah tidak dikenali.").catch(() => {});
        } catch (err) {
            console.error("[Telegram Callback] Error processing callback query:", err);
            await ctx.answerCbQuery("Terjadi kesalahan.").catch(() => {});
        }
    });

    // Launch Bot and set menu after 5 seconds to let the container network stabilize
    setTimeout(async () => {
        // Register commands list in Telegram menu
        try {
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

        // Launch Telegram polling
        bot.launch().then(() => {
            console.log("🚀 [Telegram] Bot Telegram berhasil dijalankan!");
        }).catch((err) => {
            console.error("❌ [Telegram] Gagal meluncurkan bot:", err);
        });
    }, 5000);

    // Enable graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
