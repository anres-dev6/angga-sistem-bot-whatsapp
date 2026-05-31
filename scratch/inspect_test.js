import sharp from 'sharp';

async function inspect() {
    const meta = await sharp('scratch/test_smeme_perfect_out.webp').metadata();
    console.log("=== WEBP METADATA ===");
    console.log(JSON.stringify(meta, null, 2));
}

inspect().catch(console.error);
