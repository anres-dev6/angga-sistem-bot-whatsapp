// Global cache for download URLs (to keep button IDs short)
if (!global.dlCache) {
    global.dlCache = new Map();
}

/**
 * Generate short ID for URL
 */
function getShortId(url) {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    global.dlCache.set(id, url);
    // Auto cleanup after 1 hour
    setTimeout(() => global.dlCache.delete(id), 3600000);
    return id;
}

/**
 * Send universal interactive quality buttons for any platform
 * EXACT format sesuai dokumentasi - Baileys mod v7
 */
export async function sendUniversalQualityList(
    sock,
    jid,
    title,
    platform,
    availableQualities,
    url
) {
    const emojiMap = {
        youtube: '▶️',
        tiktok: '🎵',
        instagram: '📸',
        facebook: '📘',
        default: '📥'
    };

    const emoji = emojiMap[platform] || emojiMap.default;
    const shortId = getShortId(url);

    // Sort qualities from lowest to highest
    const qualities = availableQualities.video.sort((a, b) => a - b);

    const sections = [
        {
            title: '🎬 VIDEO',
            rows: qualities.map(q => ({
                title: `VIDEO ${q}p`,
                description: `MP4 ${q}p`,
                rowId: `dl_${shortId}_v${q}`
            }))
        },
        {
            title: '🎵 AUDIO',
            rows: [
                {
                    title: 'AUDIO 128kbps',
                    description: 'MP3',
                    rowId: `dl_${shortId}_a128`
                }
            ]
        }
    ];

    await sock.sendMessage(jid, {
        text: `${emoji} *${platform.charAt(0).toUpperCase() + platform.slice(1)} Downloader*\n\n📄 *${title}*\n\nPilih kualitas di bawah:`,
        footer: 'AUTO DOWNLOADER by ANGGA BOT',
        title: '📥 PILIH KUALITAS',
        buttonText: 'Buka Menu',
        sections
    });
}

/**
 *
export async function sendFullList(sock, jid, title, platform, availableQualities, url) {
    const platformEmojis = {
        youtube: '▶️',
        tiktok: '🎵',
        instagram: '📸',
        facebook: '📘',
        twitter: '🐦',
        default: '📥'
    };

    // Generate Short ID
    const shortId = getShortId(url);
    console.log(`[Interactive] Generated Short ID: ${shortId} for URL: ${url}`);

    const emoji = platformEmojis[platform] || platformEmojis.default;
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

    const sections = [];

    // Resolution Grouping Logic
    const resolutionGroups = {
        '📱 Low Quality (Hemat Data)': [144, 240, 360],
        '🖥️ Standard Quality (HD)': [480, 720],
        '🌟 High Quality (FHD)': [1080],
        '💎 Ultra Quality (4K)': [1440, 2160]
    };

    if (availableQualities.video && availableQualities.video.length > 0) {
        for (const [category, heights] of Object.entries(resolutionGroups)) {
            // Filter qualities that match current group
            const matches = availableQualities.video.filter(q => heights.includes(q));

            if (matches.length > 0) {
                sections.push({
                    title: category,
                    rows: matches.map(q => ({
                        title: `📹 VIDEO ${q}p`,
                        description: `MP4 - ${q}p Resolution`,
                        id: `dl_${shortId}_v${q}`
                    }))
                });
            }
        }

        // If logic standard gagal (misal resolusi aneh), fallback ke "Other Qualities"
        const allGrouped = Object.values(resolutionGroups).flat();
        const others = availableQualities.video.filter(q => !allGrouped.includes(q));
        if (others.length > 0) {
            sections.push({
                title: '🎞️ OTHER QUALITIES',
                rows: others.map(q => ({
                    title: `📹 VIDEO ${q}p`,
                    description: `MP4 - ${q}p Resolution`,
                    id: `dl_${shortId}_v${q}`
                }))
            });
        }
    }

    // AUDIO Section
    sections.push({
        title: '🎵 AUDIO FORMAT',
        rows: [{
            title: '🎵 AUDIO MP3',
            description: 'MP3 - 128kbps',
            id: `dl_${shortId}_a128`
        }]
    });

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        title: `${emoji} ${platformName} Downloader`
                    },
                    body: {
                        text: `📄 *${title}*\n\nSilakan pilih kualitas download dari menu di bawah:`
                    },
                    footer: {
                        text: 'AUTO DOWNLOADER v2'
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📥 PILIH KUALITAS',
                                    sections: sections
                                })
                            }
                        ]
                    }
                }
            }
        }
    }, {});

    await sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id
    });
}

/**
 * Detect available video qualities from platform
 */
export async function detectAvailableQualities(url, platform) {
    const qualities = {
        video: [],
        audio: [128] // Compressed audio only
    };

    try {
        if (platform === 'youtube') {
            // For YouTube, provide ALL common qualities
            qualities.video = [144, 240, 360, 480, 720, 1080];
        } else {
            switch (platform) {
                case 'tiktok':
                    qualities.video = [144, 240, 360, 480, 720, 1080];
                    break;
                case 'instagram':
                    qualities.video = [144, 240, 360, 480, 720, 1080];
                    break;
                case 'facebook':
                    qualities.video = [144, 240, 360, 480, 720, 1080];
                    break;
                case 'twitter':
                    qualities.video = [144, 240, 360, 480, 720, 1080];
                    break;
                default:
                    qualities.video = [144, 240, 360, 480, 720, 1080];
            }
        }
    } catch (error) {
        console.error('[Quality Detection] Error:', error);
        qualities.video = [144, 240, 360, 480, 720, 1080];
    }

    return qualities;
}

/**
 * Send video quality buttons (for .yt command)
 * Updated for Baileys v7 - All qualities shown at once
 */
export async function sendVideoQualityList(sock, jid, title, uploader, duration, url) {
    const shortId = getShortId(url);
    console.log(`[YouTube] Generated Short ID: ${shortId}`);

    const sections = [
        {
            title: '🎬 VIDEO',
            rows: [
                { title: 'VIDEO 144p', description: 'MP4 144p', rowId: `dl_${shortId}_v144` },
                { title: 'VIDEO 240p', description: 'MP4 240p', rowId: `dl_${shortId}_v240` },
                { title: 'VIDEO 360p', description: 'MP4 360p', rowId: `dl_${shortId}_v360` },
                { title: 'VIDEO 480p', description: 'MP4 480p', rowId: `dl_${shortId}_v480` },
                { title: 'VIDEO 720p', description: 'MP4 720p', rowId: `dl_${shortId}_v720` },
                { title: 'VIDEO 1080p', description: 'MP4 1080p', rowId: `dl_${shortId}_v1080` }
            ]
        },
        {
            title: '🎵 AUDIO',
            rows: [
                { title: 'AUDIO 128kbps', description: 'MP3', rowId: `dl_${shortId}_a128` }
            ]
        }
    ];

    await sock.sendMessage(jid, {
        text: `▶️ *YouTube Downloader*\n\n📹 *${title}*\n\n👤 ${uploader}\n⏱️ ${duration}\n\nPilih kualitas di bawah:`,
        footer: 'AUTO DOWNLOADER by ANGGA BOT',
        title: '📥 PILIH KUALITAS',
        buttonText: 'Buka Menu',
        sections
    });
}


/**
 * Send audio quality buttons (for .play command)
 * Baileys mod v7 - nativeFlowMessage dengan single_select
 */
export async function sendAudioQualityList(sock, jid, title, duration, url) {
    const sections = [
        {
            title: '🎵 AUDIO QUALITY',
            rows: [
                { title: 'MP3 128kbps', description: 'Compressed', id: `ytmp3_128_${url}` },
                { title: 'MP3 320kbps', description: 'High Quality', id: `ytmp3_320_${url}` },
                { title: 'M4A Original', description: 'Best Quality', id: `ytm4a_${url}` }
            ]
        }
    ];

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        title: '🎵 Music Player'
                    },
                    body: {
                        text: `🎵 *${title}*\n\n⏱️ ${duration}\n\nPilih kualitas audio:`
                    },
                    footer: {
                        text: 'AUTO DOWNLOADER by ANGGA BOT'
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: '📥 PILIH KUALITAS',
                                    sections: sections
                                })
                            }
                        ]
                    }
                }
            }
        }
    }, {});

    await sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id
    });
}
