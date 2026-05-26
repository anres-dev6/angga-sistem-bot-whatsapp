/**
 * File Cleaner - Auto cleanup old files untuk prevent disk full
 * Run automatically tiap 1 jam untuk hapus file > 6 jam
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Clean old files from directory
 * @param {Object} options
 * @param {string} options.dir - Directory to clean (default: ./downloads)
 * @param {number} options.maxAgeMs - Max file age in milliseconds (default: 6 hours)
 */
export async function cleanOldFiles({
    dir = './downloads',
    maxAgeMs = 6 * 60 * 60 * 1000 // 6 jam
} = {}) {
    const now = Date.now();
    let deletedCount = 0;
    let deletedSize = 0;

    async function walk(folder) {
        try {
            const files = await fs.readdir(folder, { withFileTypes: true });

            for (const file of files) {
                const fullPath = path.join(folder, file.name);

                if (file.isDirectory()) {
                    await walk(fullPath);
                    continue;
                }

                try {
                    const stat = await fs.stat(fullPath);
                    const age = now - stat.mtimeMs;

                    if (age > maxAgeMs) {
                        deletedSize += stat.size;
                        await fs.unlink(fullPath);
                        deletedCount++;
                        console.log(`[CLEANER] Deleted: ${fullPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
                    }
                } catch (err) {
                    // Skip files that can't be accessed
                    console.log(`[CLEANER] Skip: ${fullPath} (${err.message})`);
                }
            }
        } catch (err) {
            console.log(`[CLEANER] Error reading ${folder}: ${err.message}`);
        }
    }

    await walk(dir);

    console.log(`[CLEANER] Cleaned ${deletedCount} files, freed ${(deletedSize / 1024 / 1024).toFixed(2)} MB`);
    return { deletedCount, deletedSize };
}

/**
 * Start auto cleanup service (call once at bot startup)
 */
export function startAutoCleanup({
    dir = './downloads',
    maxAgeMs = 6 * 60 * 60 * 1000,
    intervalMs = 60 * 60 * 1000 // tiap 1 jam
} = {}) {
    console.log('[CLEANER] Auto cleanup service started');
    console.log(`[CLEANER] Will clean ${dir} every ${intervalMs / 1000 / 60} minutes`);
    console.log(`[CLEANER] Deleting files older than ${maxAgeMs / 1000 / 60} minutes`);

    // Initial cleanup
    cleanOldFiles({ dir, maxAgeMs }).catch(err => {
        console.error('[CLEANER] Initial cleanup error:', err);
    });

    // Schedule periodic cleanup
    setInterval(() => {
        cleanOldFiles({ dir, maxAgeMs }).catch(err => {
            console.error('[CLEANER] Cleanup error:', err);
        });
    }, intervalMs);
}

/**
 * Usage example (in index.js):
 * 
 * import { startAutoCleanup } from './utils/fileCleaner.js';
 * 
 * // Start auto cleanup when bot starts
 * startAutoCleanup({
 *     dir: './downloads',
 *     maxAgeMs: 6 * 60 * 60 * 1000,  // 6 hours
 *     intervalMs: 60 * 60 * 1000      // check every 1 hour
 * });
 */
