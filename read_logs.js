import fs from 'fs';
import path from 'path';
import os from 'os';

const homeDir = os.homedir();
const logPath = path.join(homeDir, '.pm2', 'logs', 'angga-bot-out.log');
const errorLogPath = path.join(homeDir, '.pm2', 'logs', 'angga-bot-error.log');

const outputPath = path.join('c:\\Angga-Bot', 'test_log_output.txt');
let output = '';

output += `Home Dir: ${homeDir}\n`;
output += `Log Path: ${logPath}\n`;
output += `Error Log Path: ${errorLogPath}\n\n`;

output += '--- OUT LOG ---\n';
try {
    if (fs.existsSync(logPath)) {
        const data = fs.readFileSync(logPath, 'utf8');
        output += data.slice(-3000) + '\n';
    } else {
        output += `Log file not found: ${logPath}\n`;
    }
} catch (e) {
    output += `Error reading out log: ${e.message}\n`;
}

output += '\n--- ERROR LOG ---\n';
try {
    if (fs.existsSync(errorLogPath)) {
        const data = fs.readFileSync(errorLogPath, 'utf8');
        output += data.slice(-3000) + '\n';
    } else {
        output += `Error log file not found: ${errorLogPath}\n`;
    }
} catch (e) {
    output += `Error reading error log: ${e.message}\n`;
}

fs.writeFileSync(outputPath, output);
console.log('Logs written to ' + outputPath);
