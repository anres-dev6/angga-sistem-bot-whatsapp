import sharp from 'sharp';

async function test() {
    console.log('Rendering basic SVG...');
    const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="green" />
        <text x="256" y="256" font-family="sans-serif" font-size="40" fill="white" text-anchor="middle">TEST TEXT</text>
    </svg>
    `;
    
    try {
        const buffer = await sharp(Buffer.from(svg))
            .png()
            .toBuffer();
        console.log('Successfully rendered SVG. Size:', buffer.length);
        
        // Let's analyze the pixels of the rendered PNG to see if there is any white text
        // If the text rendered, there should be white pixels (RGB 255, 255, 255)
        const { data, info } = await sharp(buffer)
            .raw()
            .toBuffer({ resolveWithObject: true });
            
        let whitePixels = 0;
        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            if (r > 200 && g > 200 && b > 200) {
                whitePixels++;
            }
        }
        console.log('Total pixels:', info.width * info.height);
        console.log('White pixels detected (Text):', whitePixels);
    } catch (err) {
        console.error('Error during rendering:', err);
    }
}

test();
