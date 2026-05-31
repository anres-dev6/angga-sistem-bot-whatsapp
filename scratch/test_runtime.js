import runtimeCommand from '../commands/utility/runtime.js';

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
    },
    messageTimestamp: Math.floor(Date.now() / 1000) - 2 // Simulating 2 seconds delay
};

async function runTests() {
    console.log('Running Runtime Command Tests...');
    await runtimeCommand.run(mockSock, mockMsg, []);
    console.log('Tests Completed Successfully!');
}

runTests().catch(console.error);
