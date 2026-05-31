import emojimixCommand from '../commands/utility/emojimix.js';

// Mock socket
const mockSock = {
    sendMessage: async (from, content, options) => {
        console.log('\n--- SENT MESSAGE ---');
        console.log('To:', from);
        if (content.text) {
            console.log('Text Content:\n', content.text);
        } else if (content.sticker) {
            console.log('Sticker Content: Buffer received, length =', content.sticker.length, 'bytes');
            const strContent = content.sticker.toString('utf-8');
            console.log('Sticker metadata check ("ANRES-DEV6"):', strContent.includes('ANRES-DEV6') ? '✅ OK' : '❌ FAILED');
        } else if (content.react) {
            console.log('Reaction:', content.react.text);
        }
        console.log('--------------------\n');
        return { key: { id: 'mock-msg-id' } };
    }
};

// Mock message structure
const mockMsg = {
    key: {
        remoteJid: '12345@s.whatsapp.net',
        fromMe: false,
        id: 'ABC123XYZ'
    }
};

async function runTests() {
    console.log('Running Emojimix Command Tests...');

    // Test 1: Valid mix 😭 + 🗿
    console.log('Test 1: Mixing 😭 and 🗿 (Valid mixture)');
    await emojimixCommand.run(mockSock, mockMsg, ['😭+🗿']);

    // Test 2: Invalid mix 😭 + 😭 (No Gboard mix of identical emojis usually)
    console.log('Test 2: Mixing 😭 and 😭 (No mixture)');
    await emojimixCommand.run(mockSock, mockMsg, ['😭+😭']);

    // Test 3: Insufficient inputs
    console.log('Test 3: Missing inputs');
    await emojimixCommand.run(mockSock, mockMsg, ['😭']);
}

runTests().catch(console.error);
