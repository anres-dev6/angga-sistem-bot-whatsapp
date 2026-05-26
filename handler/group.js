import moment from "moment-timezone"; // Pastikan install moment-timezone kalo belum
import chalk from "chalk";

export default async function handleGroupParticipantsUpdate(sock, update) {
    try {
        const { id, participants, action } = update;

        // Get group metadata
        const metadata = await sock.groupMetadata(id);
        const groupName = metadata.subject;

        for (const num of participants) {
            // Convert @lid to standard @s.whatsapp.net format
            let userJid = num;
            if (num.includes('@lid')) {
                // Extract number from @lid format and convert to standard
                const numOnly = num.split('@')[0];
                // Keep original JID for now, will use it for mention
                userJid = num;
            }

            // Get profile picture
            let ppUrl;
            try {
                ppUrl = await sock.profilePictureUrl(userJid, 'image');
            } catch {
                ppUrl = null;
            }

            // Get user current time (WIB)
            const time = moment().tz("Asia/Jakarta").format("HH:mm:ss");
            const date = moment().tz("Asia/Jakarta").format("DD/MM/YYYY");

            // Extract clean number for display
            const cleanNumber = userJid.split('@')[0];

            // Text Message
            let text = "";
            if (action === "add") {
                text = `🎉 *SELAMAT DATANG!*\n\n` +
                    `👤 @${cleanNumber}\n` +
                    `📍 Grup: ${groupName}\n` +
                    `⏰ Join: ${time}\n` +
                    `📅 Tanggal: ${date}\n\n` +
                    `Semoga betah disini! 🙏`;
            } else if (action === "remove") {
                text = `👋 *GOODBYE!*\n\n` +
                    `👤 @${cleanNumber}\n` +
                    `📍 Grup: ${groupName}\n` +
                    `⏰ Keluar: ${time}\n` +
                    `📅 Tanggal: ${date}\n\n` +
                    `Titip gorengan ya! 🍪`;
            }

            if (!text) return; // Ignore promote/demote etc for now

            // Send Message - only mention the user who joined/left
            if (ppUrl) {
                await sock.sendMessage(id, {
                    image: { url: ppUrl },
                    caption: text,
                    mentions: [userJid] // Only mention this user
                });
            } else {
                await sock.sendMessage(id, {
                    text: text,
                    mentions: [userJid] // Only mention this user
                });
            }
        }
    } catch (err) {
        console.error("Group Handler Error:", err);
    }
}
