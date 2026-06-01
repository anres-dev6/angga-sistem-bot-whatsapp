import * as btch from 'btch-downloader';
console.log('btch-downloader exports:', Object.keys(btch));
if (btch.default) {
    console.log('Default exports:', Object.keys(btch.default));
}
