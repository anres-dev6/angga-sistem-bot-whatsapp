import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, '..', 'data', 'uud1945.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function cleanText(text) {
    let cleaned = text;
    
    // Remove page numbers like "-30 of 49 --" or "-31 of 49 -"
    cleaned = cleaned.replace(/-\d+\s+of\s+\d+\s*-*/g, '');
    cleaned = cleaned.replace(/-\d+\s+of\s+\d+/g, '');
    
    // Remove amendment indicators like "3)", "4)", "*)", "**)", "***)", "****)"
    cleaned = cleaned.replace(/\s*\*+\)/g, '');
    cleaned = cleaned.replace(/\s*\d+\)/g, '');
    
    // Remove duplicate headers or footnote listings at the end
    cleaned = cleaned.replace(/\s*\*+\)\s*:\s*Perubahan\s+[a-zA-Z]+/gi, '');
    cleaned = cleaned.replace(/Perubahan Pertama|Perubahan Kedua|Perubahan Ketiga|Perubahan Keempat/gi, '');
    
    // Clean spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.trim();
    
    return cleaned;
}

const cleanedData = {};

for (const pasalNum in data) {
    const pasalInfo = data[pasalNum];
    const cleanedAyat = {};
    
    for (const ayatNum in pasalInfo.ayat) {
        let text = pasalInfo.ayat[ayatNum];
        
        // Let's filter out some section titles that got accidentally parsed as ayat texts
        // E.g. "MAJELIS PERMUSYAWARATAN RAKYAT", "KEKUASAAN PEMERINTAHAN NEGARA", "KEMENTERIAN NEGARA", etc.
        // If an ayat is just a title in all-caps, we can keep it or clean it up if it's separate.
        // Actually, let's just clean the text first.
        let cleanedAyatText = cleanText(text);
        
        // Clean trailing footnotes or text fragments
        cleanedAyatText = cleanedAyatText.replace(/:\s*Perubahan\s*.*$/i, '');
        cleanedAyatText = cleanedAyatText.replace(/-\s*$/i, '');
        cleanedAyatText = cleanedAyatText.replace(/\s*\*+\s*$/i, '');
        
        if (cleanedAyatText) {
            cleanedAyat[ayatNum] = cleanedAyatText.trim();
        }
    }
    
    cleanedData[pasalNum] = {
        bab: pasalInfo.bab,
        ayat: cleanedAyat
    };
}

fs.writeFileSync(jsonPath, JSON.stringify(cleanedData, null, 2));
console.log('JSON cleaned and updated successfully!');
