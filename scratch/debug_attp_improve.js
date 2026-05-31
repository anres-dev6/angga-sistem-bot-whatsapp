import sharp from 'sharp';

async function test() {
    console.log('Testing improved ATTP SVG inline rendering...');
    
    const fontSize = 75;
    const y = 256;
    const escapedLine = 'TEST RAINBOW';
    
    // Gradient stops
    const c1 = 'hsl(0, 100%, 55%)';
    const c2 = 'hsl(60, 100%, 55%)';
    const c3 = 'hsl(120, 100%, 55%)';
    const c4 = 'hsl(180, 100%, 55%)';
    const c5 = 'hsl(240, 100%, 55%)';
    const c6 = 'hsl(300, 100%, 55%)';
    
    const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${c1}" />
                <stop offset="20%" stop-color="${c2}" />
                <stop offset="40%" stop-color="${c3}" />
                <stop offset="60%" stop-color="${c4}" />
                <stop offset="80%" stop-color="${c5}" />
                <stop offset="100%" stop-color="${c6}" />
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="#121b22" />
        <text x="256" y="${y}" font-family="sans-serif" font-weight="900" font-size="${fontSize}px" fill="url(#rainbowGrad)" stroke="#000000" stroke-width="${fontSize * 0.16}px" stroke-linejoin="round" paint-order="stroke fill" text-anchor="middle" dy="0.35em">${escapedLine}</text>
    </svg>
    `;
    
    try {
        const buffer = await sharp(Buffer.from(svg))
            .png()
            .toBuffer();
            
        const { data, info } = await sharp(buffer)
            .raw()
            .toBuffer({ resolveWithObject: true });
            
        let visiblePixels = 0;
        let coloredPixels = 0;
        
        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            // Since background is #121b22, anything else is text/gradient/stroke!
            if (r !== 0x12 || g !== 0x1b || b !== 0x22) {
                visiblePixels++;
                // If it is colored (gradient) and not pure black stroke
                if (r > 10 || g > 10 || b > 10) {
                    coloredPixels++;
                }
            }
        }
        
        console.log('Successfully rendered improved inline SVG!');
        console.log('Total pixels:', info.width * info.height);
        console.log('Visible text/stroke pixels:', visiblePixels);
        console.log('Colored gradient pixels:', coloredPixels);
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
