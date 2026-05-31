import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfUrl = 'http://jdih.bapeten.go.id/unggah/dokumen/peraturan/4-full.pdf';
const outputDir = path.join(__dirname, '..', 'data');
const pdfPath = path.join(outputDir, 'uud1945.pdf');
const jsonPath = path.join(outputDir, 'uud1945.json');

// Ensure data directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadPDF() {
    console.log('Downloading PDF...');
    const response = await axios({
        url: pdfUrl,
        method: 'GET',
        responseType: 'arraybuffer'
    });
    fs.writeFileSync(pdfPath, response.data);
    console.log('PDF Downloaded successfully.');
}

function cleanText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n+/g, '\n')
        .trim();
}

async function parseUUD() {
    await downloadPDF();
    console.log('Parsing PDF...');
    const dataBuffer = new Uint8Array(fs.readFileSync(pdfPath));
    
    const parser = new pdf.PDFParse(dataBuffer);
    const data = await parser.getText();
    const fullText = data.text;
    
    // Save raw text for debugging
    fs.writeFileSync(path.join(outputDir, 'raw_uud.txt'), fullText);
    console.log('Raw text saved. Processing structure...');
    
    // Let's analyze and parse UUD 1945 structure
    // Typically, UUD 1945 consists of:
    // BAB ...
    // Pasal 1, Pasal 2, etc.
    // Ayat (1), Ayat (2)
    
    const lines = fullText.split('\n');
    const uud = {}; // { pasalNum: { bab: '', title: '', ayat: { 1: 'text', 2: 'text' } } }
    
    let currentBab = '';
    let currentPasal = null;
    let currentAyatNum = null;
    let currentAyatText = '';
    
    let currentPasalNum = null;

    // Helper to store last ayat if any
    const saveCurrentAyat = () => {
        if (currentPasalNum !== null) {
            if (!uud[currentPasalNum]) {
                uud[currentPasalNum] = {
                    bab: currentBab,
                    ayat: {}
                };
            }
            if (currentAyatNum !== null) {
                uud[currentPasalNum].ayat[currentAyatNum] = cleanText(currentAyatText);
            } else {
                // Pasal without specific numbered ayat (sometimes has single paragraph)
                if (cleanText(currentAyatText)) {
                    uud[currentPasalNum].ayat[1] = cleanText(currentAyatText);
                }
            }
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Detect BAB
        if (/^BAB\s+[IVXLCDM]+/i.test(line)) {
            saveCurrentAyat();
            currentBab = line;
            currentAyatNum = null;
            currentAyatText = '';
            continue;
        }
        
        // Detect Pasal (e.g. "Pasal 1", "Pasal 28A", "Pasal 3")
        const pasalMatch = line.match(/^Pasal\s+(\d+[A-Z]*)/i);
        if (pasalMatch) {
            saveCurrentAyat();
            currentPasalNum = pasalMatch[1];
            currentAyatNum = null;
            currentAyatText = '';
            
            // Check if there is text after "Pasal X" on the same line
            const restOfLine = line.substring(pasalMatch[0].length).trim();
            
            // If the rest of the line has an ayat number like (1)
            const ayatMatch = restOfLine.match(/^\((\d+)\)/);
            if (ayatMatch) {
                currentAyatNum = parseInt(ayatMatch[1]);
                currentAyatText = restOfLine.substring(ayatMatch[0].length).trim() + ' ';
            } else {
                if (restOfLine) {
                    currentAyatText = restOfLine + ' ';
                }
            }
            continue;
        }
        
        // Detect Ayat (e.g. "(1)", "(2)")
        const ayatMatch = line.match(/^\((\d+)\)/);
        if (ayatMatch && currentPasalNum !== null) {
            // Save the previous ayat first
            if (currentAyatNum !== null || cleanText(currentAyatText)) {
                if (!uud[currentPasalNum]) {
                    uud[currentPasalNum] = { bab: currentBab, ayat: {} };
                }
                uud[currentPasalNum].ayat[currentAyatNum || 1] = cleanText(currentAyatText);
            }
            
            currentAyatNum = parseInt(ayatMatch[1]);
            currentAyatText = line.substring(ayatMatch[0].length).trim() + ' ';
            continue;
        }
        
        // Append to current text if inside a Pasal
        if (currentPasalNum !== null) {
            // Filter out footers/headers or page numbers
            if (/undang-undang\s+dasar|halaman|jdih/i.test(line) || /^\d+$/.test(line)) {
                continue;
            }
            currentAyatText += line + ' ';
        }
    }
    
    // Save last one
    saveCurrentAyat();
    
    // Post-processing: clean all texts
    for (const pNum in uud) {
        for (const aNum in uud[pNum].ayat) {
            uud[pNum].ayat[aNum] = uud[pNum].ayat[aNum]
                .replace(/\s+/g, ' ')
                .replace(/-\s+/g, '') // Fix word breaks
                .trim();
        }
    }
    
    fs.writeFileSync(jsonPath, JSON.stringify(uud, null, 2));
    console.log(`Success! Parsed ${Object.keys(uud).length} pasals and saved to ${jsonPath}`);
}

parseUUD().catch(console.error);
