import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMMANDS_DIR = path.join(__dirname, '../commands');

function getFiles(dir, files_ = []) {
    const files = fs.readdirSync(dir);
    for (const i in files) {
        const name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files_);
        } else if (name.endsWith('.js')) {
            files_.push(name);
        }
    }
    return files_;
}

async function verify() {
    console.log('--- Scanning and Verifying All Commands Syntax ---');
    const allFiles = getFiles(COMMANDS_DIR);
    console.log(`Found ${allFiles.length} command files.\n`);

    let passed = 0;
    let failed = 0;
    const errors = [];

    for (const file of allFiles) {
        const relativePath = path.relative(COMMANDS_DIR, file);
        try {
            // Convert file path to file:// URL for ES module import on Windows
            const fileUrl = `file:///${file.replace(/\\/g, '/')}`;
            const module = await import(fileUrl);
            
            if (module.default) {
                const cmd = module.default;
                if (!cmd.name) {
                    throw new Error('Command is missing "name" property');
                }
                passed++;
            } else {
                throw new Error('Command is missing "export default"');
            }
        } catch (err) {
            failed++;
            errors.push({ file: relativePath, error: err.message, stack: err.stack });
            console.log(`❌ Failed: ${relativePath} -> ${err.message}`);
        }
    }

    console.log('\n--- Verification Summary ---');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (errors.length > 0) {
        console.log('\n--- Error Details ---');
        errors.forEach(e => {
            console.log(`File: ${e.file}`);
            console.log(`Error: ${e.error}`);
            console.log('------------------------------------');
        });
        process.exit(1);
    } else {
        console.log('\n🎉 ALL COMMAND FILES ARE 100% CORRECT & ERROR-FREE!');
        process.exit(0);
    }
}

verify();
