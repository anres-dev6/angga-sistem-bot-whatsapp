/**
 * Create quality selection list (for more than 3 options)
 * @param {Array} formats - Available video formats
 * @returns {object} WhatsApp list message object
 */
export function createQualityList(formats) {
    const sections = [];
    const map = {
        'Low Quality': 360,
        'Standard Quality': 720,
        'High Quality': 1080,
        'Ultra Quality': 2160
    };

    for (const [title, h] of Object.entries(map)) {
        const rows = formats
            .filter(f => {
                if (!f.resolution) return false;
                // Match resolution number: '1280x720' -> 720, '720p' -> 720
                const match = f.resolution.match(/(\d{3,4})/g);
                if (match) {
                    const height = parseInt(match[match.length - 1]); // usually last number is height
                    return height === h;
                }
                return false;
            })
            .slice(0, 10)
            .map(f => ({
                title: `${h}p ${f.ext.toUpperCase()}`,
                description: `${f.vcodec || 'codec?'} • ${f.filesize ? formatFileSize(f.filesize) : 'Size unknown'}`,
                id: `ytv_${h}_${f.ext}` // Fixed: id instead of rowId
            }));

        if (rows.length) {
            sections.push({ title, rows });
        }
    }

    // Fallback if empty
    if (!sections.length) {
        // Just take first 10 generic
        sections.push({
            title: 'Available Formats',
            rows: formats.slice(0, 10).map(f => ({
                title: `${f.resolution || 'Unknown'} ${f.ext?.toUpperCase() || ''}`,
                description: f.vcodec || 'Unknown codec',
                id: `ytv_${f.format_id}`
            }))
        });
    }

    return {
        title: "📹 SELECT VIDEO QUALITY",
        buttonText: "Choose Quality",
        sections: sections
    };
}

/**
 * Create audio quality buttons
 * @returns {Array} Button array
 */
export function createAudioQualityButtons() {
    return [
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: '🎵 MP3 128kbps',
                id: 'ytmp3_128'
            })
        },
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: '🎵 MP3 192kbps',
                id: 'ytmp3_192'
            })
        },
        {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: '🎵 MP3 320kbps',
                id: 'ytmp3_320'
            })
        }
    ];
}

/**
 * Create audio quality list (for more options)
 * @returns {object} WhatsApp list message object
 */
export function createAudioQualityList() {
    return {
        title: "🎵 SELECT AUDIO QUALITY",
        buttonText: "Choose Quality",
        sections: [
            {
                title: "MP3 Format",
                rows: [
                    { title: "MP3 128kbps", description: "Small size, good quality", id: "ytmp3_128" },
                    { title: "MP3 192kbps", description: "Balanced size & quality", id: "ytmp3_192" },
                    { title: "MP3 256kbps", description: "High quality", id: "ytmp3_256" },
                    { title: "MP3 320kbps", description: "Best MP3 quality", id: "ytmp3_320" }
                ]
            },
            {
                title: "Other Formats",
                rows: [
                    { title: "M4A Original", description: "Lossless quality", id: "ytm4a" },
                    { title: "OPUS", description: "Efficient codec", id: "ytopus" },
                    { title: "OGG Vorbis", description: "Open format", id: "ytogg" }
                ]
            }
        ]
    };
}

/**
 * Create quality buttons (max 3 for button message)
 * @param {Array} formats - Available video formats
 * @returns {Array} Button array
 */
export function createQualityButtons(formats) {
    const common = ['360', '720', '1080'];
    const buttons = [];

    for (const height of common) {
        const format = formats.find(f =>
            f.resolution && f.resolution.startsWith(height)
        );

        if (format) {
            buttons.push({
                buttonId: `ytv_${format.format_id}`,
                buttonText: {
                    displayText: `📹 ${format.resolution} ${format.ext.toUpperCase()}`
                },
                type: 1
            });
        }

        if (buttons.length >= 3) break;
    }

    return buttons;
}

/**
 * Create video info message
 * @param {object} info - Video information
 * @returns {string} Formatted message
 */
export function createVideoInfoMessage(info) {
    return `📹 *VIDEO INFO*\n\n` +
        `📝 *Judul:* ${info.title}\n` +
        `👤 *Channel:* ${info.uploader}\n` +
        `⏱️ *Durasi:* ${formatDuration(info.duration)}\n` +
        `👁️ *Views:* ${formatNumber(info.view_count)}\n` +
        `📅 *Upload:* ${formatDate(info.upload_date)}\n\n` +
        `📊 *Available Formats:*\n` +
        `• Video: ${info.video.length} options\n` +
        `• Audio: ${info.audio.length} options`;
}

/**
 * Format file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format number with thousand separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format upload date
 * @param {string} dateStr - Date string (YYYYMMDD)
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}/${year}`;
}
