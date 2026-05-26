import axios from 'axios';
import FormData from 'form-data';
import { fileTypeFromBuffer } from 'file-type';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

/**
 * Upload image to Telegra.ph
 * @param {Buffer} buffer 
 * @returns {Promise<string>} URL
 */
export async function uploadToTelegraph(buffer) {
    try {
        const { ext, mime } = await fileTypeFromBuffer(buffer) || { ext: 'jpg', mime: 'image/jpeg' };

        const form = new FormData();
        form.append('file', buffer, { filename: `tmp.${ext}`, contentType: mime });

        const { data } = await axios.post('https://telegra.ph/upload', form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': USER_AGENT
            }
        });

        if (data && data[0] && data[0].src) {
            return 'https://telegra.ph' + data[0].src;
        } else {
            throw new Error('Failed to upload to Telegra.ph');
        }
    } catch (e) {
        throw new Error(`Telegra.ph error: ${e.message}`);
    }
}

/**
 * Upload to Catbox.moe
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
export async function uploadToCatbox(buffer) {
    try {
        const { ext, mime } = await fileTypeFromBuffer(buffer) || { ext: 'jpg', mime: 'image/jpeg' };

        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', buffer, { filename: `media.${ext}`, contentType: mime });

        const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': USER_AGENT
            }
        });

        if (typeof data === 'string' && data.startsWith('http')) {
            return data.trim();
        }
        throw new Error('Failed to upload to Catbox');
    } catch (e) {
        throw new Error(`Catbox error: ${e.message}`);
    }
}

/**
 * Upload to Pomf.lain.la
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
export async function uploadToPomf(buffer) {
    try {
        const { ext, mime } = await fileTypeFromBuffer(buffer) || { ext: 'jpg', mime: 'image/jpeg' };

        const form = new FormData();
        form.append('files[]', buffer, { filename: `file.${ext}`, contentType: mime });

        const { data } = await axios.post('https://pomf.lain.la/upload.php', form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': USER_AGENT
            }
        });

        if (data.success && data.files && data.files[0]) {
            return data.files[0].url;
        }
        throw new Error('Failed to upload to Pomf');
    } catch (e) {
        throw new Error(`Pomf error: ${e.message}`);
    }
}

/**
 * Upload to Uguu.se
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
export async function uploadToUguu(buffer) {
    try {
        const { ext, mime } = await fileTypeFromBuffer(buffer) || { ext: 'jpg', mime: 'image/jpeg' };

        const form = new FormData();
        form.append('files[]', buffer, { filename: `file.${ext}`, contentType: mime });

        const { data } = await axios.post('https://uguu.se/upload.php', form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': USER_AGENT
            }
        });

        if (data.success && data.files && data.files[0]) {
            return data.files[0].url;
        }
        throw new Error('Failed to upload to Uguu');
    } catch (e) {
        throw new Error(`Uguu error: ${e.message}`);
    }
}

/**
 * Unified Upload Function: Tries multiple providers
 * Order: Pomf -> Catbox -> Telegra -> Uguu
 * @param {Buffer} buffer 
 * @returns {Promise<string>}
 */
export async function uploadMedia(buffer) {
    const providers = [
        { name: 'Pomf', func: uploadToPomf },
        { name: 'Catbox', func: uploadToCatbox },
        { name: 'Telegra', func: uploadToTelegraph },
        { name: 'Uguu', func: uploadToUguu }
    ];

    let lastError;

    for (const provider of providers) {
        try {
            const url = await provider.func(buffer);
            if (url) return url;
        } catch (e) {
            console.error(`${provider.name} failed:`, e.message);
            lastError = e;
        }
    }

    throw new Error(`Semua server upload gagal. Terakhir: ${lastError?.message}`);
}
