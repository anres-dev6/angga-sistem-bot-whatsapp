import { detectPlatform } from './detect.js';
import * as resolvers from '../resolvers/index.js';

export async function universalEngine(url, ctx) {
    const platform = detectPlatform(url);
    if (!platform) return null; // Not supported or not detected

    console.log(`[AutoDL V3] Detected platform: ${platform}`);

    if (!resolvers[platform]) {
        throw new Error(`Resolver untuk ${platform} belum diimplementasikan di AutoDL V3.`);
    }

    const result = await resolvers[platform](url, ctx);
    return result;
}
