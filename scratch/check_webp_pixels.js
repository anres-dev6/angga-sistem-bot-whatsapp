import sharp from 'sharp';

async function check(filePath) {
    console.log(`Checking file: ${filePath}`);
    try {
        const { data, info } = await sharp(filePath)
            .raw()
            .toBuffer({ resolveWithObject: true });
            
        console.log(`Size: ${info.width}x${info.height}, channels: ${info.channels}, buffer: ${data.length} bytes`);
        
        let visiblePixels = 0;
        let whitePixels = 0;
        for (let i = 0; i < data.length; i += info.channels) {
            const alpha = info.channels === 4 ? data[i+3] : 255;
            if (alpha > 10) {
                visiblePixels++;
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                if (r > 200 && g > 200 && b > 200) {
                    whitePixels++;
                }
            }
        }
        console.log('Visible pixels (Alpha > 10):', visiblePixels);
        console.log('White pixels detected:', whitePixels);
    } catch (err) {
        console.error(`Error checking ${filePath}:`, err.message);
    }
    console.log('--------------------------------------------------');
}

async function run() {
    await check('scratch/test_attp_output.webp');
    await check('scratch/test_qc_output.webp');
}

run();
