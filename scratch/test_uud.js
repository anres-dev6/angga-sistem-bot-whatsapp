import uudCommand from '../commands/utility/uud.js';

// Mock socket
const mockSock = {
    sendMessage: async (from, content, options) => {
        console.log('\n--- SENT MESSAGE ---');
        console.log('To:', from);
        console.log('Content:\n', content.text);
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
    console.log('Running UUD Command Tests...');

    // Test 1: No arguments (Help Menu)
    console.log('Test 1: Help Menu');
    await uudCommand.run(mockSock, mockMsg, []);

    // Test 2: Explicit "pasal 1"
    console.log('Test 2: Explicit "pasal 1"');
    await uudCommand.run(mockSock, mockMsg, ['pasal', '1']);

    // Test 3: Explicit "pasal 28A"
    console.log('Test 3: Explicit "pasal 28A"');
    await uudCommand.run(mockSock, mockMsg, ['pasal', '28A']);

    // Test 4: Explicit "pasal 28A ayat 1"
    console.log('Test 4: Explicit "pasal 28A ayat 1"');
    await uudCommand.run(mockSock, mockMsg, ['pasal', '28A', 'ayat', '1']);

    // Test 5: Quick search "1"
    console.log('Test 5: Quick search "1"');
    await uudCommand.run(mockSock, mockMsg, ['1']);

    // Test 6: Quick search "28A 2"
    console.log('Test 6: Quick search "28A 2"');
    await uudCommand.run(mockSock, mockMsg, ['28A', '2']);

    // Test 7: Non-existent pasal
    console.log('Test 7: Non-existent pasal');
    await uudCommand.run(mockSock, mockMsg, ['99']);

    // Test 8: Non-existent ayat
    console.log('Test 8: Non-existent ayat');
    await uudCommand.run(mockSock, mockMsg, ['pasal', '1', 'ayat', '5']);
}

runTests().catch(console.error);
