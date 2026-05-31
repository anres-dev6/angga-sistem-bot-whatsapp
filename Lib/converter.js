import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { tmpdir } from "os";
import sharp from "sharp";

function getRandomFile(ext) {
    return path.join(tmpdir(), `${Date.now()}.${ext}`);
}

export async function imageToWebp(buffer) {
    // Use SHARP for images (no ffmpeg needed)
    return await sharp(buffer)
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 85, effort: 6 })
        .toBuffer();
}

export async function videoToWebp(buffer) {
    const tmpFileIn = getRandomFile('mp4');
    const tmpFileOut = getRandomFile('webp');

    fs.writeFileSync(tmpFileIn, buffer);

    return new Promise((resolve, reject) => {
        // Convert to gif-like webp using FFMPEG
        const cmd = `ffmpeg -i "${tmpFileIn}" -vcodec libwebp -vf "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15, pad=512:512:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" -loop 0 -ss 00:00:00 -t 00:00:05 -preset default -an -vsync 0 "${tmpFileOut}"`;

        exec(cmd, (err) => {
            fs.unlinkSync(tmpFileIn);

            if (err) {
                // Check if error is due to missing ffmpeg
                if (err.message.includes('not recognized') || err.code === 127) {
                    return reject(new Error("FFmpeg tidak ditemukan. Silahkan install FFmpeg untuk stiker video."));
                }
                return reject(err);
            }

            if (!fs.existsSync(tmpFileOut)) {
                return reject(new Error("FFmpeg gagal menghasilkan file."));
            }

            const buff = fs.readFileSync(tmpFileOut);
            fs.unlinkSync(tmpFileOut);
            resolve(buff);
        });
    });
}
