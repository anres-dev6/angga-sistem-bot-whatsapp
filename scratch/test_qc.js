import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Test Quotly (.qc) sticker layout generation using Sharp and SVG
const colors = ['#25D366', '#34B7F1', '#F78154', '#FD5B78', '#FFD700', '#ADFF2F', '#FF69B4', '#00FFFF', '#FF7F50', '#DA70D6'];

const getJidColor = (jid) => {
    let hash = 0;
    for (let i = 0; i < jid.length; i++) {
        hash = jid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
};

function wrapText(text, maxCharsPerLine = 22) {
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
    return lines.slice(0, 6); // Limit to max 6 lines
}

async function testQc(name, text, senderJid) {
    const lines = wrapText(text, 22);
    console.log('Wrapped text lines:', lines);
    
    const maxLineLen = Math.max(...lines.map(l => l.length));
    
    // Bubble properties
    const bubbleBgColor = '#202c33';
    const nameColor = getJidColor(senderJid);
    
    const fontSize = 22;
    const lineHeight = fontSize * 1.25;
    
    // Dimensions
    const bubbleWidth = 350;
    const nameHeight = 30;
    const padding = 20;
    const textHeight = lines.length * lineHeight;
    
    const bubbleHeight = padding * 2 + nameHeight + textHeight;
    const bubbleY = 256 - bubbleHeight / 2;
    
    const nameY = bubbleY + padding + nameHeight / 2;
    const textStartY = bubbleY + padding + nameHeight + 10;
    
    console.log(`Bubble: height=${bubbleHeight}, y=${bubbleY}`);
    
    // Fallback avatar
    const initial = name.charAt(0).toUpperCase();
    const avatarColor = getJidColor(senderJid);
    const avatarSvg = `
    <circle cx="70" cy="256" r="40" fill="${avatarColor}" />
    <text x="70" y="256" font-family="'Impact', 'Arial Black', sans-serif" font-size="40" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initial}</text>
    `;
    
    let textLinesSvg = '';
    lines.forEach((line, idx) => {
        const y = textStartY + idx * lineHeight + lineHeight / 2;
        const escaped = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        textLinesSvg += `<text x="150" y="${y}" font-family="'Arial', 'Helvetica', sans-serif" font-size="${fontSize}" fill="#ffffff" text-anchor="start" dominant-baseline="central">${escaped}</text>\n`;
    });
    
    const escapedName = name
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
        
    const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.4" />
            </filter>
        </defs>
        
        <rect width="100%" height="100%" fill="none" />
        
        <!-- Avatar -->
        ${avatarSvg}
        
        <!-- Bubble Group -->
        <g filter="url(#shadow)">
            <!-- Speech Bubble Tail -->
            <path d="M 125 246 L 113 256 L 125 266 Z" fill="${bubbleBgColor}" />
            <!-- Bubble Body -->
            <rect x="125" y="${bubbleY}" width="${bubbleWidth}" height="${bubbleHeight}" rx="18" ry="18" fill="${bubbleBgColor}" />
        </g>
        
        <!-- Text -->
        <text x="150" y="${nameY}" font-family="'Arial Black', 'Impact', sans-serif" font-weight="900" font-size="24" fill="${nameColor}" text-anchor="start" dominant-baseline="central">${escapedName}</text>
        
        ${textLinesSvg}
    </svg>
    `;
    
    // Write SVG frame to png
    const pngPath = 'scratch/test_qc_output.png';
    await sharp(Buffer.from(svg))
        .png()
        .toFile(pngPath);
        
    // Convert to webp sticker
    const webpPath = 'scratch/test_qc_output.webp';
    await sharp(pngPath)
        .webp({ quality: 90 })
        .toFile(webpPath);
        
    console.log('Sticker saved successfully to scratch/test_qc_output.webp');
}

testQc('Angga Bot', 'Halo Dunia! Ini adalah tes stiker quote (.qc) yang dibuat secara lokal offline.', '6285708950373@s.whatsapp.net');
