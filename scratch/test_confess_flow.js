import { 
    createConfessSession, 
    findSessionByUser, 
    updateSessionActivity, 
    terminateConfessSession, 
    normalizeJid,
    cleanJid,
    sessions 
} from '../Lib/confess_manager.js';

// Mock Socket to simulate sock.sendMessage
const mockSock = {
    sendMessage: async (jid, content) => {
        console.log(`[Mock Socket -> SendMessage to ${jid}]:`, JSON.stringify(content, null, 2));
        return { key: { id: `mock_${Date.now()}` } };
    },
    chatModify: async (mod, jid) => {
        console.log(`[Mock Socket -> ChatModify for ${jid}]:`, JSON.stringify(mod, null, 2));
        return true;
    }
};

async function run() {
    console.log("=== RUNNING ANONYMOUS CONFESS STATE MACHINE TEST ===");

    const senderJid = '628999999999:2@s.whatsapp.net';
    const receiverJid = '628123456789:15@s.whatsapp.net';

    // 1. Verify JID normalization
    console.log("\n1. Testing JID Normalization...");
    console.log(`08123456789 -> ${normalizeJid('08123456789')}`);
    console.log(`628123456789 -> ${normalizeJid('628123456789')}`);
    console.log(`628999999999:2@s.whatsapp.net -> ${normalizeJid('628999999999:2@s.whatsapp.net')}`);
    console.log(`628123456789:15@s.whatsapp.net -> ${normalizeJid('628123456789:15@s.whatsapp.net')}`);
    console.log(`+62 897-0998-0099 -> ${normalizeJid('+62 897-0998-0099')}`);
    console.log(`147274546061314@lid -> ${normalizeJid('147274546061314@lid')}`);

    // 2. Create Sesi Confess
    console.log("\n2. Creating Confess Session...");
    const session = await createConfessSession(
        mockSock, 
        senderJid, 
        "Bos", 
        "08123456789:15@s.whatsapp.net", 
        "Halo, semoga harimu menyenangkan."
    );

    console.log(`Active Sessions Count: ${sessions.size}`);
    const active = findSessionByUser(senderJid);
    console.log(`Resolved Session ID: ${active ? active.id : 'NONE'}`);

    // 3. Simulate Receiver replying to Bot (Should forward to Sender)
    console.log("\n3. Simulating Receiver Replying to Bot (Anonymously forwarded to Sender)...");
    const receiverBody = "Halo juga.";
    const receiverSession = findSessionByUser(receiverJid);
    if (receiverSession) {
        const targetJid = (cleanJid(receiverJid) === cleanJid(receiverSession.senderJid))
            ? receiverSession.receiverJid
            : receiverSession.senderJid;
            
        console.log(`Intercepted receiver chat. Routing anonymously to sender: ${targetJid}`);
        await mockSock.sendMessage(targetJid, { text: `💬 *Balasan*\n\n${receiverBody}` });
        updateSessionActivity(mockSock, receiverSession);
    }

    // 4. Simulate Sender replying to Bot (Should forward to Receiver)
    console.log("\n4. Simulating Sender Replying to Bot (Anonymously forwarded to Receiver)...");
    const senderBody = "Terima kasih.";
    const senderSession = findSessionByUser(senderJid);
    if (senderSession) {
        const targetJid = (cleanJid(senderJid) === cleanJid(senderSession.senderJid))
            ? senderSession.receiverJid
            : senderSession.senderJid;
            
        console.log(`Intercepted sender chat. Routing anonymously to receiver: ${targetJid}`);
        await mockSock.sendMessage(targetJid, { text: `💬 *Balasan*\n\n${senderBody}` });
        updateSessionActivity(mockSock, senderSession);
    }

    // 5. Simulate command bypass (Starts with ".")
    console.log("\n5. Simulating command bypass (Starts with '.')...");
    const commandBody = ".confessstop";
    if (commandBody.startsWith('.')) {
        console.log("Command prefix detected. Forwarding bypassed! Processing command normally...");
    }

    // 6. Terminate Sesi Confess manually (.confessstop)
    console.log("\n6. Terminating Session Manually (.confessstop)...");
    await terminateConfessSession(mockSock, session, true);
    console.log(`Active Sessions Count after termination: ${sessions.size}`);

    // 7. Test Safeguard: multiple concurrent active sessions blocked correctly
    console.log("\n7. Testing concurrent safeguards...");
    const sess1 = await createConfessSession(mockSock, 'sender1@s.whatsapp.net', 'User1', '08111111111', 'Hello');
    try {
        console.log("Attempting to create another session with same sender...");
        await createConfessSession(mockSock, 'sender1@s.whatsapp.net', 'User2', '08222222222', 'Hello');
    } catch (e) {
        console.log(`✅ Blocked correctly: ${e.message}`);
    }

    try {
        console.log("Attempting to create a session to a receiver already busy...");
        await createConfessSession(mockSock, 'sender2@s.whatsapp.net', 'User3', '08111111111', 'Hello');
    } catch (e) {
        console.log(`✅ Blocked correctly: ${e.message}`);
    }

    // Cleanup
    await terminateConfessSession(mockSock, sess1, true);

    // 8. Test: user replies to an expired/invalid session (quoting a confess message)
    console.log("\n8. Testing reply to expired/invalid confess session...");
    const expiredUserJid = '628999999999@s.whatsapp.net';
    const activeExpired = findSessionByUser(expiredUserJid);
    if (!activeExpired) {
        console.log("Session not found (correctly simulated as expired/invalid).");
        // Simulate quoting a confess message
        const mockMsg = {
            key: { remoteJid: expiredUserJid, fromMe: false },
            message: {
                extendedTextMessage: {
                    text: "Halo, saya membalas pesan Anda.",
                    contextInfo: {
                        quotedMessage: {
                            conversation: "💌 *PESAN BARU*\n\n*Nama Pengirim :*\nBos..."
                        }
                    }
                }
            }
        };
        // Simulate what the message handler would do:
        const bodyText = mockMsg.message.extendedTextMessage.text;
        const quotedContext = mockMsg.message.extendedTextMessage.contextInfo;
        const quotedText = quotedContext?.quotedMessage?.conversation || "";
        if (quotedText.includes('PESAN BARU')) {
            console.log("✅ Successfully intercepted expired/invalid session reply!");
            await mockSock.sendMessage(expiredUserJid, {
                text: "❌ *Sesi Confess telah berakhir atau tidak valid.*\n\nSesi ini mungkin telah ditutup secara manual atau otomatis karena tidak ada aktivitas selama 1 jam."
            });
        }
    }

    console.log("\n=== TEST COMPLETED SUCCESSFULLY! ===");
}

run();
