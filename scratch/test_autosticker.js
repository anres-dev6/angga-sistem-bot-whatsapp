import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setAutoSticker, isAutoStickerEnabled } from '../Lib/autosticker_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
    console.log('Running AutoSticker Manager and State Tests...');

    const testJid = '123456789@g.us';

    console.log('1. Setting AutoSticker ON for test JID:', testJid);
    setAutoSticker(testJid, true);

    const isEnabledOn = isAutoStickerEnabled(testJid);
    console.log('   Check if enabled (expected true):', isEnabledOn ? '✅ YES' : '❌ NO');

    if (!isEnabledOn) {
        throw new Error('AutoSticker state not set correctly to true.');
    }

    console.log('2. Setting AutoSticker OFF for test JID:', testJid);
    setAutoSticker(testJid, false);

    const isEnabledOff = isAutoStickerEnabled(testJid);
    console.log('   Check if enabled (expected false):', !isEnabledOff ? '✅ YES' : '❌ NO');

    if (isEnabledOff) {
        throw new Error('AutoSticker state not set correctly to false.');
    }

    console.log('🎉 ALL AUTOSTICKER STATE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(console.error);
