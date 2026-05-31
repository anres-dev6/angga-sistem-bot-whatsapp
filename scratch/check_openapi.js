import fs from 'fs';

const contentPath = 'C:\\Users\\gakyy\\.gemini\\antigravity\\brain\\1abc3312-847f-4a4d-97fa-84caf75e1f02\\.system_generated\\steps\\615\\content.md';

try {
    const fileContent = fs.readFileSync(contentPath, 'utf8');
    const jsonStartIdx = fileContent.indexOf('{"openapi":');
    if (jsonStartIdx === -1) {
        throw new Error('Could not find JSON start');
    }
    const jsonStr = fileContent.substring(jsonStartIdx);
    const obj = JSON.parse(jsonStr.trim());
    
    const paths = Object.keys(obj.paths);
    
    console.log('Paths with gif/anim/sticker/webp/text/image:');
    const filtered = paths.filter(p => {
        const lp = p.toLowerCase();
        return lp.includes('gif') || lp.includes('anim') || lp.includes('sticker') || lp.includes('webp') || lp.includes('text') || lp.includes('image');
    });
    console.log(filtered);
} catch (err) {
    console.error('Error:', err);
}
