/**
 * Retry Downloader - Auto retry dengan max duration 1 jam
 * Untuk handle network failures, throttling, ffmpeg crashes
 */

export async function retryDownload(
    taskFn,
    {
        maxDurationMs = 60 * 60 * 1000, // 1 jam
        retryDelayMs = 30_000           // 30 detik
    } = {}
) {
    const start = Date.now();
    let attempt = 0;

    while (Date.now() - start < maxDurationMs) {
        attempt++;
        try {
            console.log(`[Retry] Attempt ${attempt}...`);
            return await taskFn(attempt);
        } catch (err) {
            console.log(`[Retry] Attempt ${attempt} failed: ${err.message}`);

            // Check if we have time for another retry
            if (Date.now() - start + retryDelayMs > maxDurationMs) {
                throw new Error('Retry timeout (1 jam) - download gagal setelah multiple attempts');
            }

            // Wait before retry
            console.log(`[Retry] Waiting ${retryDelayMs}ms before next attempt...`);
            await new Promise(r => setTimeout(r, retryDelayMs));
        }
    }

    throw new Error('Retry timeout (1 jam)');
}

/**
 * Usage example:
 * 
 * await retryDownload(async (attempt) => {
 *     return await downloadWithProgress(url, quality);
 * });
 */
