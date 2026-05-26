/**
 * Progress Bar Utility - WhatsApp-friendly progress display
 * Update progress dengan edit message (tidak spam)
 */

/**
 * Render progress bar ASCII
 * @param {number} percent - Progress percentage (0-100)
 * @param {number} total - Total bar length (default: 10)
 * @returns {string} Progress bar string
 */
export function renderProgress(percent, total = 10) {
    const filled = Math.round((percent / 100) * total);
    const empty = total - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * Format duration to MM:SS
 */
export function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create progress updater dengan smart throttling
 * @param {Object} sock - WhatsApp socket
 * @param {string} jid - Chat JID
 * @param {Object} messageKey - Message key untuk edit
 * @param {Object} options
 * @returns {Function} Update function
 */
export function createProgressUpdater(sock, jid, messageKey, {
    title = 'Downloading',
    minUpdateInterval = 5 // minimum update interval (% change)
} = {}) {
    let lastPercent = 0;
    let lastUpdateTime = 0;
    const minTimeInterval = 2000; // min 2 seconds between updates

    return async function updateProgress({
        percent = 0,
        speed = '',
        eta = '',
        downloaded = '',
        total = ''
    }) {
        const now = Date.now();
        const percentChange = percent - lastPercent;
        const timeElapsed = now - lastUpdateTime;

        // Skip update if change too small and time too short
        if (percentChange < minUpdateInterval && timeElapsed < minTimeInterval) {
            return;
        }

        lastPercent = percent;
        lastUpdateTime = now;

        const bar = renderProgress(percent);

        let text = `⏬ *${title}*\n\n`;
        text += `${bar} ${percent.toFixed(0)}%\n\n`;

        if (speed) text += `⚡ Speed: ${speed}\n`;
        if (eta) text += `⏱️ ETA: ${eta}\n`;
        if (downloaded && total) text += `📦 ${downloaded} / ${total}`;

        try {
            await sock.sendMessage(jid, {
                text: text
            }, { edit: messageKey });
        } catch (err) {
            console.error('[Progress] Update error:', err.message);
        }
    };
}

/**
 * Usage example:
 * 
 * // Create progress message
 * const progressMsg = await sock.sendMessage(jid, {
 *     text: '⏳ Starting download...'
 * });
 * 
 * // Create updater
 * const updateProgress = createProgressUpdater(sock, jid, progressMsg.key, {
 *     title: 'Downloading 720p'
 * });
 * 
 * // In download callback
 * function onProgress(p) {
 *     updateProgress({
 *         percent: p.percent,
 *         speed: formatBytes(p.speed) + '/s',
 *         eta: formatDuration(p.eta),
 *         downloaded: formatBytes(p.downloaded),
 *         total: formatBytes(p.total)
 *     });
 * }
 * 
 * await downloadVideo(url, quality, { onProgress });
 */
