import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

/**
 * Compress audio file using ffmpeg
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 * @param {string} bitrate - Target bitrate (e.g., '128k', '64k')
 * @returns {Promise<void>}
 */
export async function compressAudio(inputPath, outputPath, bitrate = '128k') {
    try {
        console.log(`[Compress] Compressing audio to ${bitrate}...`);

        const cmd = `ffmpeg -i "${inputPath}" -b:a ${bitrate} -y "${outputPath}"`;
        await execPromise(cmd, { timeout: 60000 });

        console.log('[Compress] Audio compressed successfully');
    } catch (error) {
        console.error('[Compress] Audio compression error:', error);
        throw new Error(`Failed to compress audio: ${error.message}`);
    }
}

/**
 * Compress video file using ffmpeg
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 * @param {string} quality - CRF value (18-28, lower = better quality)
 * @returns {Promise<void>}
 */
export async function compressVideo(inputPath, outputPath, quality = '28') {
    try {
        console.log(`[Compress] Compressing video with CRF ${quality}...`);

        const cmd = `ffmpeg -i "${inputPath}" -c:v libx264 -crf ${quality} -preset fast -c:a aac -b:a 128k -y "${outputPath}"`;
        await execPromise(cmd, { timeout: 300000 }); // 5 min timeout

        console.log('[Compress] Video compressed successfully');
    } catch (error) {
        console.error('[Compress] Video compression error:', error);
        throw new Error(`Failed to compress video: ${error.message}`);
    }
}

/**
 * Auto compress file if it exceeds size limit
 * @param {string} filePath - File to check and compress
 * @param {number} maxSizeMB - Maximum size in MB
 * @param {string} type - 'audio' or 'video'
 * @returns {Promise<{compressed: boolean, path: string, originalSize: number, newSize: number}>}
 */
export async function autoCompress(filePath, maxSizeMB = 25, type = 'audio') {
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB <= maxSizeMB) {
        return {
            compressed: false,
            path: filePath,
            originalSize: fileSizeMB,
            newSize: fileSizeMB
        };
    }

    console.log(`[Compress] File too large (${fileSizeMB.toFixed(2)}MB), compressing...`);

    const ext = path.extname(filePath);
    const compressedPath = filePath.replace(ext, `_compressed${ext}`);

    try {
        if (type === 'audio') {
            // Try different bitrates until file is small enough
            const bitrates = ['128k', '96k', '64k'];
            for (const bitrate of bitrates) {
                await compressAudio(filePath, compressedPath, bitrate);

                const newStats = fs.statSync(compressedPath);
                const newSizeMB = newStats.size / (1024 * 1024);

                if (newSizeMB <= maxSizeMB) {
                    // Delete original, rename compressed
                    fs.unlinkSync(filePath);
                    fs.renameSync(compressedPath, filePath);

                    return {
                        compressed: true,
                        path: filePath,
                        originalSize: fileSizeMB,
                        newSize: newSizeMB
                    };
                }
            }
        } else if (type === 'video') {
            // Try different CRF values
            const crfValues = ['28', '30', '32'];
            for (const crf of crfValues) {
                await compressVideo(filePath, compressedPath, crf);

                const newStats = fs.statSync(compressedPath);
                const newSizeMB = newStats.size / (1024 * 1024);

                if (newSizeMB <= maxSizeMB) {
                    // Delete original, rename compressed
                    fs.unlinkSync(filePath);
                    fs.renameSync(compressedPath, filePath);

                    return {
                        compressed: true,
                        path: filePath,
                        originalSize: fileSizeMB,
                        newSize: newSizeMB
                    };
                }
            }
        }

        // If still too large after all attempts, return compressed version anyway
        const finalStats = fs.statSync(compressedPath);
        const finalSizeMB = finalStats.size / (1024 * 1024);

        fs.unlinkSync(filePath);
        fs.renameSync(compressedPath, filePath);

        return {
            compressed: true,
            path: filePath,
            originalSize: fileSizeMB,
            newSize: finalSizeMB
        };

    } catch (error) {
        // If compression fails, return original file
        console.error('[Compress] Compression failed, using original file');
        if (fs.existsSync(compressedPath)) {
            fs.unlinkSync(compressedPath);
        }

        return {
            compressed: false,
            path: filePath,
            originalSize: fileSizeMB,
            newSize: fileSizeMB,
            error: error.message
        };
    }
}
