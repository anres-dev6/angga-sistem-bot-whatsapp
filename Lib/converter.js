import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { tmpdir } from "os";

function getRandomFile(ext) {
    return path.join(tmpdir(), `${Date.now()}.${ext}`);
}

export async function imageToWebp(buffer) {
    // Dynamically import sharp to prevent startup crashes when sharp fails to load
    let sharp;
    try {
        sharp = (await import("sharp")).default;
    } catch (e) {
        throw new Error("Modul 'sharp' tidak dapat dimuat pada perangkat ini. Silakan hubungi administrator.");
    }
    // Use SHARP for images (no ffmpeg needed)
    return await sharp(buffer)
        .rotate() // Auto-orient based on EXIF orientation metadata
        .ensureAlpha() // Ensure alpha channel exists for perfect transparent borders
        .resize(512, 512, {
            fit: 'cover'
        })
        .webp({ quality: 85, effort: 6 })
        .toBuffer();
}

export async function videoToWebp(buffer) {
    const tmpFileIn = getRandomFile('mp4');
    const tmpFileOut = getRandomFile('webp');

    fs.writeFileSync(tmpFileIn, buffer);

    return new Promise((resolve, reject) => {
        // Convert to high-quality transparent 1:1 square animated WebP using FFmpeg
        const cmd = `ffmpeg -i "${tmpFileIn}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0.0" -loop 0 -ss 00:00:00 -t 00:00:05 -preset default -an -vsync 0 "${tmpFileOut}"`;

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
