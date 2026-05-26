import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

export const db = {
    /**
     * Save buffer to a temporary file
     * @param {Buffer} buffer 
     * @param {string} ext 
     * @returns {Promise<string>} Absolute path to the saved file
     */
    saveTemp: async (buffer, ext = 'tmp') => {
        const filename = `angb_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = path.join(tmpdir(), filename);
        await fs.promises.writeFile(filePath, buffer);
        return filePath;
    },

    /**
     * Delete a file
     * @param {string} filePath 
     */
    deleteTemp: async (filePath) => {
        try {
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        } catch (err) {
            console.error(`Failed to delete temp file ${filePath}:`, err);
        }
    }
};
