/**
 * Detect platform from URL
 * @param {string} url - URL to check
 * @returns {object|null} Platform info or null
 */
export function detectPlatform(url) {
    if (!url) return null;

    const urlLower = url.toLowerCase();

    // YouTube
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
        return {
            platform: 'youtube',
            name: 'YouTube',
            type: urlLower.includes('/shorts/') ? 'short' : 'video'
        };
    }

    // Instagram
    if (urlLower.includes('instagram.com')) {
        return {
            platform: 'instagram',
            name: 'Instagram',
            type: urlLower.includes('/reel/') ? 'reel' :
                urlLower.includes('/stories/') ? 'story' : 'post'
        };
    }

    // TikTok
    if (urlLower.includes('tiktok.com') || urlLower.includes('vt.tiktok.com') || urlLower.includes('vm.tiktok.com')) {
        return {
            platform: 'tiktok',
            name: 'TikTok',
            type: 'video'
        };
    }

    // Facebook
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.com')) {
        return {
            platform: 'facebook',
            name: 'Facebook',
            type: urlLower.includes('/reel/') ? 'reel' : 'video'
        };
    }

    // Twitter/X
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
        return {
            platform: 'twitter',
            name: 'Twitter/X',
            type: 'video'
        };
    }

    // Twitch
    if (urlLower.includes('twitch.tv')) {
        return {
            platform: 'twitch',
            name: 'Twitch',
            type: urlLower.includes('/clip/') ? 'clip' : 'video'
        };
    }

    // Reddit
    if (urlLower.includes('reddit.com') || urlLower.includes('redd.it')) {
        return {
            platform: 'reddit',
            name: 'Reddit',
            type: 'video'
        };
    }

    // Vimeo
    if (urlLower.includes('vimeo.com')) {
        return {
            platform: 'vimeo',
            name: 'Vimeo',
            type: 'video'
        };
    }

    // Dailymotion
    if (urlLower.includes('dailymotion.com') || urlLower.includes('dai.ly')) {
        return {
            platform: 'dailymotion',
            name: 'Dailymotion',
            type: 'video'
        };
    }

    // SoundCloud
    if (urlLower.includes('soundcloud.com')) {
        return {
            platform: 'soundcloud',
            name: 'SoundCloud',
            type: 'audio'
        };
    }

    // Bandcamp
    if (urlLower.includes('bandcamp.com')) {
        return {
            platform: 'bandcamp',
            name: 'Bandcamp',
            type: 'audio'
        };
    }

    // Spotify
    if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify.com')) {
        return {
            platform: 'spotify',
            name: 'Spotify',
            type: 'audio'
        };
    }

    // Streamable
    if (urlLower.includes('streamable.com')) {
        return {
            platform: 'streamable',
            name: 'Streamable',
            type: 'video'
        };
    }

    // Bilibili
    if (urlLower.includes('bilibili.com')) {
        return {
            platform: 'bilibili',
            name: 'Bilibili',
            type: 'video'
        };
    }

    // Niconico
    if (urlLower.includes('nicovideo.jp') || urlLower.includes('nico.ms')) {
        return {
            platform: 'niconico',
            name: 'Niconico',
            type: 'video'
        };
    }

    // Kick
    if (urlLower.includes('kick.com')) {
        return {
            platform: 'kick',
            name: 'Kick',
            type: 'video'
        };
    }

    // Rumble
    if (urlLower.includes('rumble.com')) {
        return {
            platform: 'rumble',
            name: 'Rumble',
            type: 'video'
        };
    }

    // Odysee
    if (urlLower.includes('odysee.com')) {
        return {
            platform: 'odysee',
            name: 'Odysee',
            type: 'video'
        };
    }

    // Pinterest
    if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) {
        return {
            platform: 'pinterest',
            name: 'Pinterest',
            type: 'video'
        };
    }

    // LinkedIn
    if (urlLower.includes('linkedin.com')) {
        return {
            platform: 'linkedin',
            name: 'LinkedIn',
            type: 'video'
        };
    }

    // Threads
    if (urlLower.includes('threads.net')) {
        return {
            platform: 'threads',
            name: 'Threads',
            type: 'video'
        };
    }

    // Generic - if has video/media URL patterns
    if (urlLower.match(/\.(mp4|webm|mkv|avi|mov|flv|wmv|m4v)$/i)) {
        return {
            platform: 'direct',
            name: 'Direct Media',
            type: 'video'
        };
    }

    if (urlLower.match(/\.(mp3|m4a|aac|opus|ogg|wav|flac)$/i)) {
        return {
            platform: 'direct',
            name: 'Direct Media',
            type: 'audio'
        };
    }

    return null;
}

/**
 * Extract URLs from text
 * @param {string} text - Text to search
 * @returns {Array} Array of URLs
 */
export function extractURLs(text) {
    if (!text) return [];

    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlPattern);

    if (!matches) return [];

    return matches.map(url => {
        // Clean URL (remove trailing punctuation)
        url = url.replace(/[.,;!?]+$/, '');

        const platform = detectPlatform(url);
        return {
            url,
            platform: platform?.platform || 'unknown',
            platformName: platform?.name || 'Unknown',
            type: platform?.type || 'unknown'
        };
    });
}

/**
 * Check if URL is supported by yt-dlp
 * @param {string} url - URL to check
 * @returns {boolean} Is supported
 */
export function isSupported(url) {
    const platform = detectPlatform(url);
    return platform !== null;
}

/**
 * Get platform emoji
 * @param {string} platform - Platform name
 * @returns {string} Emoji
 */
export function getPlatformEmoji(platform) {
    const emojis = {
        youtube: '📺',
        instagram: '📸',
        tiktok: '🎵',
        facebook: '👥',
        twitter: '🐦',
        twitch: '🎮',
        reddit: '🤖',
        vimeo: '🎬',
        dailymotion: '📹',
        soundcloud: '🎧',
        bandcamp: '🎸',
        spotify: '🎵',
        streamable: '📺',
        bilibili: '📺',
        niconico: '📺',
        kick: '🎮',
        rumble: '📹',
        odysee: '📺',
        pinterest: '📌',
        linkedin: '💼',
        threads: '🧵',
        direct: '📥'
    };

    return emojis[platform] || '🔗';
}
