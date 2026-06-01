import { detectPlatform } from '../autodlv3/engine/detect.js';
import * as resolvers from '../autodlv3/resolvers/index.js';
import downloader from '../Lib/downloader.js';
import abDownloader from '../utils/abDownloader.js';
import dlCmd from '../commands/download/dl.js';

console.log('--- Verifying AutoDL Files Syntax ---');
console.log('1. detectPlatform exported:', typeof detectPlatform);
console.log('2. resolvers loaded:', Object.keys(resolvers));
console.log('3. downloader.js loaded:', typeof downloader.downloadMedia);
console.log('4. abDownloader loaded:', typeof abDownloader.downloadMedia);
console.log('5. dl.js command loaded:', dlCmd.name);

console.log('\n✅ ALL MODIFIED FILES COMPILED AND LOADED SUCCESSFULLY! NO SYNTAX ERRORS.');
