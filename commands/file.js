import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { isOwner, sanitizePath, logActivity, needsConfirmation, confirmationManager, formatSize } from '../utils/security.js';
import { fileSessionManager } from '../utils/fileSession.js';

export default {
    name: 'file',
    aliases: ['file', 'f'],
    tags: ['owner'],
    description: 'File manager with folder navigation',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        const operation = args[0]?.toLowerCase();

        // Get current directory for this user
        const currentDir = fileSessionManager.getCurrentDir(sender);

        // Show help if no operation
        if (!operation) {
            return sock.sendMessage(from, {
                text: `📁 *FILE MANAGER*

📂 *Current:* ${currentDir}

*Navigation:*
• .file cd [folder] - Masuk folder
• .file cd .. - Keluar folder
• .file pwd - Lihat current folder

*File Operations:*
• .file create [name] [content]
• .file read [name] [--full]
• .file getfile [name] - Kirim sebagai file
• .file edit [name] [content]
• .file delete [name]
• .file list

*Examples:*
.file cd commands
.file create test.js code here
.file read test.js
.file read test.js --full
.file getfile config.js
.file list
.file cd ..

💡 File otomatis di: ${currentDir}
🔒 Owner-only`
            });
        }

        try {
            switch (operation) {
                case 'cd': {
                    const targetDir = args[1];

                    if (!targetDir) {
                        return sock.sendMessage(from, {
                            text: `❌ Usage: .file cd [folder]

📂 Current: ${currentDir}

*Examples:*
.file cd commands
.file cd utils
.file cd ..`
                        });
                    }

                    let newDir;
                    if (targetDir === '..') {
                        if (currentDir === '.') {
                            return sock.sendMessage(from, {
                                text: "❌ Sudah di root!"
                            });
                        }
                        newDir = path.dirname(currentDir);
                        if (newDir === '.') newDir = '.';
                    } else if (targetDir === '~' || targetDir === '/') {
                        newDir = '.';
                    } else {
                        newDir = currentDir === '.' ? targetDir : path.join(currentDir, targetDir);
                    }

                    const fullPath = sanitizePath(newDir);
                    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
                        return sock.sendMessage(from, {
                            text: `❌ Folder tidak ada: ${targetDir}`
                        });
                    }

                    fileSessionManager.setCurrentDir(sender, newDir);
                    logActivity(sender, `file cd ${newDir}`, 'Success');

                    return sock.sendMessage(from, {
                        text: `✅ Pindah folder

📂 Current: ${newDir}

💡 .file list untuk lihat isi`
                    });
                }


                case 'getfile': {
                    const fileName = args[1];

                    if (!fileName) {
                        return sock.sendMessage(from, {
                            text: `❌ Usage: .file getfile [name]

📂 Current: ${currentDir}

💡 Kirim file sebagai dokumen WhatsApp
*Example:*
.file getfile config.js`
                        });
                    }

                    const filePath = currentDir === '.' ? fileName : path.join(currentDir, fileName);
                    const fullPath = sanitizePath(filePath);

                    if (!fs.existsSync(fullPath)) {
                        return sock.sendMessage(from, {
                            text: `❌ File tidak ada: ${fileName}`
                        });
                    }

                    if (fs.statSync(fullPath).isDirectory()) {
                        return sock.sendMessage(from, {
                            text: `❌ ${fileName} adalah folder

💡 Use .file cd ${fileName}`
                        });
                    }

                    const fileSize = fs.statSync(fullPath).size;
                    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

                    if (fileSize > MAX_FILE_SIZE) {
                        return sock.sendMessage(from, {
                            text: `❌ File terlalu besar: ${formatSize(fileSize)}

📏 Max: ${formatSize(MAX_FILE_SIZE)}
💡 Use .file read ${fileName} --full untuk lihat isi`
                        });
                    }

                    // Send processing reaction
                    await sock.sendMessage(from, {
                        react: { text: '⏳', key: msg.key }
                    });

                    try {
                        const fileBuffer = fs.readFileSync(fullPath);

                        await sock.sendMessage(from, {
                            document: fileBuffer,
                            fileName: path.basename(fileName),
                            mimetype: 'application/octet-stream',
                            caption: `📄 *${path.basename(fileName)}*\n📏 ${formatSize(fileSize)}\n📂 ${currentDir}`
                        }, { quoted: msg });

                        await sock.sendMessage(from, {
                            react: { text: '✅', key: msg.key }
                        });

                        logActivity(sender, `file getfile ${filePath}`, 'Success');

                        return sock.sendMessage(from, {
                            text: `✅ File terkirim!\n\n💡 Download untuk lihat isi lengkap`
                        });

                    } catch (err) {
                        console.error('[File GetFile] Error:', err);
                        await sock.sendMessage(from, {
                            react: { text: '❌', key: msg.key }
                        });

                        return sock.sendMessage(from, {
                            text: `❌ Gagal mengirim file: ${err.message}`
                        });
                    }
                }

                case 'pwd': {
                    return sock.sendMessage(from, {
                        text: `📂 *Current Directory*

Path: ${currentDir}

💡 .file cd [folder] untuk pindah`
                    });
                }

                case 'create': {
                    const fileName = args[1];
                    const content = args.slice(2).join(' ');

                    if (!fileName || !content) {
                        return sock.sendMessage(from, {
                            text: `❌ Usage: .file create [name] [content]

📂 Current: ${currentDir}

*Example:*
.file create test.txt Hello World`
                        });
                    }

                    const filePath = currentDir === '.' ? fileName : path.join(currentDir, fileName);
                    const fullPath = sanitizePath(filePath);

                    if (fs.existsSync(fullPath)) {
                        return sock.sendMessage(from, {
                            text: `❌ File sudah ada: ${fileName}

💡 Use .file edit untuk ubah`
                        });
                    }

                    const dir = path.dirname(fullPath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    fs.writeFileSync(fullPath, content, 'utf8');
                    logActivity(sender, `file create ${filePath}`, 'Success');

                    return sock.sendMessage(from, {
                        text: `✅ File created!

📁 ${filePath}
📏 ${formatSize(content.length)}

📂 Current: ${currentDir}`
                    });
                }

                case 'read': {
                    const fileName = args[1];
                    const hasFullFlag = args.includes('--full') || args.includes('-f');

                    if (!fileName) {
                        return sock.sendMessage(from, {
                            text: `❌ Usage: .file read [name] [--full]

📂 Current: ${currentDir}

💡 Options:
• .file read test.js (max 4000 chars)
• .file read test.js --full (tampilkan semua)`
                        });
                    }

                    const filePath = currentDir === '.' ? fileName : path.join(currentDir, fileName);
                    const fullPath = sanitizePath(filePath);

                    if (!fs.existsSync(fullPath)) {
                        return sock.sendMessage(from, {
                            text: `❌ File tidak ada: ${fileName}`
                        });
                    }

                    if (fs.statSync(fullPath).isDirectory()) {
                        return sock.sendMessage(from, {
                            text: `❌ ${fileName} adalah folder

💡 Use .file cd ${fileName}`
                        });
                    }

                    const content = fs.readFileSync(fullPath, 'utf8');
                    const size = fs.statSync(fullPath).size;

                    logActivity(sender, `file read ${filePath}${hasFullFlag ? ' --full' : ''}`, 'Success');

                    // If --full flag is used, send complete content (chunked if needed)
                    if (hasFullFlag) {
                        const MAX_LENGTH = 4000; // WhatsApp message limit

                        if (content.length <= MAX_LENGTH) {
                            // Send as single message
                            return sock.sendMessage(from, {
                                text: `📄 *${fileName}* (FULL)
📏 ${formatSize(size)}
📂 ${currentDir}

\`\`\`
${content}
\`\`\``
                            });
                        } else {
                            // Split into chunks
                            const chunks = [];
                            let remaining = content;

                            while (remaining.length > 0) {
                                chunks.push(remaining.substring(0, MAX_LENGTH));
                                remaining = remaining.substring(MAX_LENGTH);
                            }

                            // Send header
                            await sock.sendMessage(from, {
                                text: `📄 *${fileName}* (FULL - ${chunks.length} parts)
📏 ${formatSize(size)}
📂 ${currentDir}

⏳ Mengirim ${chunks.length} pesan...`
                            });

                            // Send chunks
                            for (let i = 0; i < chunks.length; i++) {
                                await sock.sendMessage(from, {
                                    text: `📄 Part ${i + 1}/${chunks.length}

\`\`\`
${chunks[i]}
\`\`\``
                                });

                                // Small delay to avoid rate limit
                                if (i < chunks.length - 1) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            }

                            return sock.sendMessage(from, {
                                text: `✅ File lengkap terkirim (${chunks.length} parts)`
                            });
                        }
                    }

                    // Default behavior: truncate at 4000 chars
                    const displayContent = content.length > 4000
                        ? content.substring(0, 4000) + '\n\n... (truncated)\n\n💡 Use .file read ' + fileName + ' --full untuk lihat semua'
                        : content;

                    return sock.sendMessage(from, {
                        text: `📄 *${fileName}*
📏 ${formatSize(size)}
📂 ${currentDir}

\`\`\`
${displayContent}
\`\`\``
                    });
                }

                case 'edit': {
                    const fileName = args[1];
                    const content = args.slice(2).join(' ');

                    if (!fileName || !content) {
                        return sock.sendMessage(from, {
                            text: `❌ Usage: .file edit [name] [content]

📂 Current: ${currentDir}`
                        });
                    }

                    const filePath = currentDir === '.' ? fileName : path.join(currentDir, fileName);
                    const fullPath = sanitizePath(filePath);

                    if (!fs.existsSync(fullPath)) {
                        return sock.sendMessage(from, {
                            text: `❌ File tidak ada: ${fileName}

💡 Use .file create untuk buat baru`
                        });
                    }

                    const oldSize = fs.statSync(fullPath).size;
                    fs.writeFileSync(fullPath, content, 'utf8');

                    logActivity(sender, `file edit ${filePath}`, 'Success');

                    return sock.sendMessage(from, {
                        text: `✅ File updated!

📁 ${filePath}
📏 ${formatSize(oldSize)} → ${formatSize(content.length)}

📂 Current: ${currentDir}`
                    });
                }

                case 'delete': {
                    const fileName = args[1];

                    if (!fileName) {
                        return sock.sendMessage(from, {
                            text: `❌ Usage: .file delete [name]

📂 Current: ${currentDir}`
                        });
                    }

                    const filePath = currentDir === '.' ? fileName : path.join(currentDir, fileName);
                    const fullPath = sanitizePath(filePath);

                    if (!fs.existsSync(fullPath)) {
                        return sock.sendMessage(from, {
                            text: `❌ File tidak ada: ${fileName}`
                        });
                    }

                    confirmationManager.create(sender, 'file_delete', { path: fullPath, displayPath: filePath });

                    return sock.sendMessage(from, {
                        text: `⚠️ *CONFIRM DELETE*

📁 ${filePath}

⏰ Reply "yes" untuk confirm (30s)
💡 Reply "no" untuk cancel`
                    });
                }

                case 'list': {
                    const fullPath = sanitizePath(currentDir);

                    if (!fs.existsSync(fullPath)) {
                        return sock.sendMessage(from, {
                            text: `❌ Folder tidak ada: ${currentDir}`
                        });
                    }

                    const items = fs.readdirSync(fullPath);

                    if (items.length === 0) {
                        return sock.sendMessage(from, {
                            text: `📁 ${currentDir}

(empty folder)`
                        });
                    }

                    let output = `📁 *${currentDir}*\n\n`;

                    items.forEach(item => {
                        const itemPath = path.join(fullPath, item);
                        const stats = fs.statSync(itemPath);

                        if (stats.isDirectory()) {
                            output += `📂 ${item}/\n`;
                        } else {
                            output += `📄 ${item} (${formatSize(stats.size)})\n`;
                        }
                    });

                    output += `\n📊 Total: ${items.length} items`;

                    logActivity(sender, `file list ${currentDir}`, 'Success');

                    return sock.sendMessage(from, { text: output });
                }

                default:
                    return sock.sendMessage(from, {
                        text: `❌ Unknown operation: ${operation}

💡 Use .file untuk help`
                    });
            }

        } catch (error) {
            console.error('[File] Error:', error);
            logActivity(sender, `file ${operation}`, 'Error', error.message);

            return sock.sendMessage(from, {
                text: `❌ Error: ${error.message}`
            });
        }
    }
};
