// Test font sizing calculations for old vs new smeme formulas
const testCases = [
    "AKU",
    "HALO DUNIA",
    "AKU PAS DOSEN BILANG CUMA 1 SOAL",
    "AKU PAS LIAT NILAI UTS KELUAR",
    "SANGAT PANJANG SEKALI SAMPAI BATAS MAKSIMUM KARAKTER"
];

// Helper from smeme.js to wrap text
function wrapText(text, maxCharsPerLine = 16) {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3);
}

function getOldFontSize(lines) {
    if (lines.length === 0) return 0;
    const maxLen = Math.max(...lines.map(l => l.length));
    let size = 42;
    if (maxLen > 8) size = Math.floor(380 / (maxLen * 0.9));
    if (size < 24) size = 24;
    if (size > 46) size = 46;
    return size;
}

function getNewFontSize(lines) {
    if (lines.length === 0) return 0;
    const maxLen = Math.max(...lines.map(l => l.length));
    // Anton/Impact font characters are narrow (about 0.45 - 0.55 of font size in width)
    // Target printable width is 450px out of 512px
    let size = Math.floor(450 / (maxLen * 0.55));
    if (size < 30) size = 30; // Minimum size for high legibility
    if (size > 55) size = 55; // Capped at 55px (medium/sedengan size)
    return size;
}

console.log("=== FONT SIZE TEST ===");
for (const tc of testCases) {
    const uppercaseText = tc.toUpperCase();
    const lines = wrapText(uppercaseText, 16);
    const oldSize = getOldFontSize(lines);
    const newSize = getNewFontSize(lines);
    console.log(`\nInput: "${tc}"`);
    console.log(`Wrapped Lines: ${JSON.stringify(lines)}`);
    console.log(`Max Line Length: ${lines.length > 0 ? Math.max(...lines.map(l => l.length)) : 0}`);
    console.log(`Old Font Size: ${oldSize}px`);
    console.log(`New Font Size: ${newSize}px`);
}
