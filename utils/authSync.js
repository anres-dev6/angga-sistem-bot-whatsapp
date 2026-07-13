import fs from 'fs';
import { join } from 'path';
import { proto, initAuthCreds, BufferJSON } from 'baileys';

export function useMultiFileAuthStateSync(folder) {
    const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');

    const writeData = (data, file) => {
        const filePath = join(folder, fixFileName(file));
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, BufferJSON.replacer));
        } catch (error) {
            console.error(`[AuthSync] Failed to write data to ${file}:`, error);
        }
    };

    const readData = (file) => {
        try {
            const filePath = join(folder, fixFileName(file));
            if (!fs.existsSync(filePath)) return null;
            const data = fs.readFileSync(filePath, { encoding: 'utf-8' });
            return JSON.parse(data, BufferJSON.reviver);
        } catch (error) {
            return null;
        }
    };

    const removeData = (file) => {
        try {
            const filePath = join(folder, fixFileName(file));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            // Ignore error
        }
    };

    if (fs.existsSync(folder)) {
        const folderInfo = fs.statSync(folder);
        if (!folderInfo.isDirectory()) {
            throw new Error(`found something that is not a directory at ${folder}, either delete it or specify a different location`);
        }
    } else {
        fs.mkdirSync(folder, { recursive: true });
    }

    const creds = readData('creds.json') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        let value = readData(`${type}-${id}.json`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const file = `${category}-${id}.json`;
                            if (value) {
                                writeData(value, file);
                            } else {
                                removeData(file);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds.json');
        }
    };
}
