import { exec } from 'child_process';
import { getYtdlpPath, getYtdlpBaseArgs } from '../utils/ytdlpBinary.js';

const testUrl = 'https://www.instagram.com/reel/C8q_t_XyQ7t/';
const ytdlpCmd = getYtdlpPath();
console.log('yt-dlp path:', ytdlpCmd);

const cmd = `"${ytdlpCmd}" --no-playlist -g "${testUrl}"`;
console.log('Executing:', cmd);

exec(cmd, (err, stdout, stderr) => {
    if (err) {
        console.log('Error:', err.message);
        console.log('Stderr:', stderr);
    } else {
        console.log('Success! Output URL:', stdout);
    }
});
