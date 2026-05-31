import fs from 'fs';
import sharp from 'sharp';

// Test exact Quotly SVG layout rendering
async function test() {
    const name = 'Angga Bot';
    const text = 'Halo Dunia! Ini adalah tes stiker quote (.qc) yang dibuat secara lokal offline.';
    const senderJid = '6285708950373@s.whatsapp.net';
    
    const lines = [
        'Halo Dunia! Ini adalah',
        'tes stiker quote (.qc)',
        'yang dibuat secara',
        'lokal offline.'
    ];
    
    const bubbleBgColor = '#202c33';
    const nameColor = '#25D366';
    
    const fontSize = 22;
    const lineHeight = fontSize * 1.28;
    
    const bubbleWidth = 350;
    const nameHeight = 30;
    const padding = 20;
    const textHeight = lines.length * lineHeight;
    
    const bubbleHeight = padding * 2 + nameHeight + textHeight;
    const bubbleY = 256 - bubbleHeight / 2;
    
    const nameY = bubbleY + padding + nameHeight / 2;
    const textStartY = bubbleY + padding + nameHeight + 10;
    
    // Fallback avatar
    const initial = 'A';
    const avatarColor = '#25D366';
    const avatarSvg = `
    <circle cx="70" cy="256" r="40" fill="${avatarColor}" />
    <text x="70" y="256" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="900" fill="#ffffff" text-anchor="middle" dy="0.35em">${initial}</text>
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
        // Using dy="0.35em" instead of dominant-baseline and unquoted font-family
        textLinesSvg += `<text x="150" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="#ffffff" text-anchor="start" dy="0.35em">${escaped}</text>\n`;
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
        
        <rect width="100%" height="100%" fill="#121b22" /> <!-- dark WhatsApp background to verify visibility -->
        
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
        <text x="150" y="${nameY}" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="24" fill="${nameColor}" text-anchor="start" dy="0.35em">${escapedName}</text>
        
        ${textLinesSvg}
    </svg>
    `;
    
    await sharp(Buffer.from(svg))
        .png()
        .toFile('scratch/debug_qc_output.png');
        
    console.log('debug_qc_output.png written successfully.');
}

test().catch(console.error);
