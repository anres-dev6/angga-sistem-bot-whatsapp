/**
 * User Queue System - Queue per user untuk prevent spam dan CPU overload
 * Satu user hanya bisa punya 1 download aktif, sisanya masuk queue
 */

// Global queue storage
if (!global.userQueues) {
    global.userQueues = new Map();
}

/**
 * Enqueue task untuk user
 * @param {string} userId - User ID (JID)
 * @param {Function} taskFn - Async function to execute
 * @returns {Promise} Result dari task
 */
export function enqueueUserTask(userId, taskFn) {
    if (!global.userQueues.has(userId)) {
        global.userQueues.set(userId, []);
    }

    const queue = global.userQueues.get(userId);

    return new Promise((resolve, reject) => {
        queue.push({ taskFn, resolve, reject });

        // If this is the only task, start immediately
        if (queue.length === 1) {
            runNext(userId);
        }
    });
}

/**
 * Run next task in queue
 */
async function runNext(userId) {
    const queue = global.userQueues.get(userId);

    if (!queue || queue.length === 0) {
        global.userQueues.delete(userId);
        return;
    }

    const { taskFn, resolve, reject } = queue[0];

    try {
        const result = await taskFn();
        resolve(result);
    } catch (err) {
        reject(err);
    } finally {
        queue.shift(); // Remove completed task
        runNext(userId); // Process next
    }
}

/**
 * Get queue length for user
 */
export function getUserQueueLength(userId) {
    return global.userQueues.get(userId)?.length || 0;
}

/**
 * Usage example:
 * 
 * const userId = msg.key.participant || msg.key.remoteJid;
 * const queueLength = getUserQueueLength(userId);
 * 
 * if (queueLength > 1) {
 *     await sock.sendMessage(jid, {
 *         text: `⏳ Permintaan masuk antrean (#${queueLength})`
 *     });
 * }
 * 
 * enqueueUserTask(userId, async () => {
 *     await handleDownload({ sock, jid, url, quality });
 * }).catch(err => {
 *     sock.sendMessage(jid, { text: `❌ Download gagal: ${err.message}` });
 * });
 */
