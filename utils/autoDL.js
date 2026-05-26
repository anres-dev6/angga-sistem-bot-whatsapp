// AutoDL Configuration
// Manages automatic download settings per chat

const autoDLSettings = new Map();

/**
 * Enable AutoDL for a chat
 * @param {string} chatId - Chat JID
 * @param {object} options - AutoDL options
 */
export function enableAutoDL(chatId, options = {}) {
    autoDLSettings.set(chatId, {
        enabled: true,
        youtube: options.youtube !== false,
        instagram: options.instagram !== false,
        tiktok: options.tiktok !== false,
        facebook: options.facebook !== false,
        twitter: options.twitter !== false,
        quality: options.quality || 'auto', // auto, high, medium, low
        ...options
    });
}

/**
 * Disable AutoDL for a chat
 * @param {string} chatId - Chat JID
 */
export function disableAutoDL(chatId) {
    autoDLSettings.delete(chatId);
}

/**
 * Check if AutoDL is enabled for a chat
 * @param {string} chatId - Chat JID
 * @returns {object|null} AutoDL settings or null
 */
export function getAutoDLSettings(chatId) {
    return autoDLSettings.get(chatId) || null;
}

/**
 * Detect URLs in message
 * @param {string} text - Message text
 * @returns {Array} Array of detected URLs with platform info
 */
export function detectURLs(text) {
    if (!text) return [];

    const urls = [];

    // YouTube patterns
    const youtubePatterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/gi
    ];

    // Instagram patterns
    const instagramPatterns = [
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/gi,
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/stories\/([a-zA-Z0-9._]+)\/([0-9]+)/gi
    ];

    // TikTok patterns
    const tiktokPatterns = [
        /(?:https?:\/\/)?(?:www\.|vm\.)?tiktok\.com\/@?([a-zA-Z0-9._-]+)\/video\/([0-9]+)/gi,
        /(?:https?:\/\/)?(?:vt\.tiktok\.com|vm\.tiktok\.com)\/([a-zA-Z0-9]+)/gi
    ];

    // Facebook patterns
    const facebookPatterns = [
        /(?:https?:\/\/)?(?:www\.|web\.|m\.)?facebook\.com\/(?:watch\/?\?v=|.*\/videos?\/)([0-9]+)/gi,
        /(?:https?:\/\/)?(?:www\.|web\.|m\.)?facebook\.com\/reel\/([0-9]+)/gi,
        /(?:https?:\/\/)?fb\.watch\/([a-zA-Z0-9_-]+)/gi
    ];

    // Twitter/X patterns
    const twitterPatterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/([0-9]+)/gi
    ];

    // Check YouTube
    for (const pattern of youtubePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            urls.push({
                url: match[0],
                platform: 'youtube',
                id: match[1],
                type: match[0].includes('/shorts/') ? 'short' : 'video'
            });
        }
    }

    // Check Instagram
    for (const pattern of instagramPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            urls.push({
                url: match[0],
                platform: 'instagram',
                id: match[1],
                type: match[0].includes('/reel/') ? 'reel' :
                    match[0].includes('/stories/') ? 'story' : 'post'
            });
        }
    }

    // Check TikTok
    for (const pattern of tiktokPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            urls.push({
                url: match[0],
                platform: 'tiktok',
                id: match[1] || match[2]
            });
        }
    }

    // Check Facebook
    for (const pattern of facebookPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            urls.push({
                url: match[0],
                platform: 'facebook',
                id: match[1],
                type: match[0].includes('/reel/') ? 'reel' : 'video'
            });
        }
    }

    // Check Twitter
    for (const pattern of twitterPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            urls.push({
                url: match[0],
                platform: 'twitter',
                id: match[1]
            });
        }
    }

    return urls;
}

/**
 * Get all chats with AutoDL enabled
 * @returns {Map} AutoDL settings map
 */
export function getAllAutoDLChats() {
    return autoDLSettings;
}
