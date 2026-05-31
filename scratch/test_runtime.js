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

// Mock message structure simulating a Group Chat
const mockGroupMsg = {
    key: {
        remoteJid: '987654321@g.us', // Simulating Group JID
        fromMe: false,
        id: 'ABC123XYZ'
    },
    messageTimestamp: Math.floor(Date.now() / 1000) - 1
};

async function runTests() {
    console.log('Running Runtime Command Test inside a Group...');
    await runtimeCommand.run(mockSock, mockGroupMsg, []);
    console.log('Group Test Completed Successfully!');
}

runTests().catch(console.error);
