import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../../config.js';
import { isOwner, logActivity } from '../../utils/security.js';

const execAsync = promisify(exec);

export default {
    name: 'exec',
    aliases: ['exec', 'cmd', '$'],
    tags: ['owner'],
    description: 'Execute terminal/CMD commands',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        // Owner check
        if (!isOwner(sender)) {
            return sock.sendMessage(from, {
                text: "❌ Owner-only command!"
            });
        }

        console.log('[EXEC] User:', sender);

        const command = args.join(' ');

        // Show help if no command
        if (!command) {
            return sock.sendMessage(from, {
                text: `💻 *TERMINAL EXECUTOR*

*Usage:*
.exec [command]

*Examples:*
.exec dir
.exec git status
.exec npm --version
.exec node --version
.exec pm2 list
.exec pm2 restart all

*Features:*
✅ All commands allowed
✅ No restrictions
✅ Full system access

⚠️ Max timeout: 30 seconds
🔒 Owner-only access`
            });
        }

        try {
            // No command blocking - all commands allowed
            await sock.sendMessage(from, {
                react: { text: '⏳', key: msg.key }
            });

            await sock.sendMessage(from, {
                text: `💻 Executing: \`${command}\`\n\n⏳ Please wait...`
            });

            // Execute command with timeout
            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000, // 30 seconds
                cwd: process.cwd(),
                maxBuffer: 1024 * 1024 // 1MB
            });

            const output = stdout || stderr || '(no output)';

            // Limit output to 4000 chars
            const displayOutput = output.length > 4000
                ? output.substring(0, 4000) + '\n\n... (truncated)'
                : output;

            logActivity(sender, `exec ${command}`, 'Success');

            await sock.sendMessage(from, {
                react: { text: '✅', key: msg.key }
            });

            return sock.sendMessage(from, {
                text: `💻 *Command Output*\n\n\`\`\`\n${displayOutput}\n\`\`\``
            });

        } catch (error) {
            console.error('[Exec] Error:', error);
            logActivity(sender, `exec ${command}`, 'Error', error.message);

            await sock.sendMessage(from, {
                react: { text: '❌', key: msg.key }
            });

            let errorMsg = `❌ *Command Failed*\n\n`;

            if (error.killed || error.message.includes('timeout')) {
                errorMsg += `⏱️ Command timed out (>30s)\n\n💡 Command: ${command}`;
            } else if (error.code) {
                errorMsg += `📝 Exit code: ${error.code}\n\n`;

                // Show stderr if available
                if (error.stderr) {
                    const stderr = error.stderr.substring(0, 500);
                    errorMsg += `Error output:\n\`\`\`\n${stderr}\n\`\`\``;
                } else {
                    errorMsg += `💡 Command: ${command}`;
                }
            } else {
                errorMsg += `📝 ${error.message}`;
            }

            return sock.sendMessage(from, { text: errorMsg });
        }
    }
};
