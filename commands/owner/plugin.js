import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../../config.js';
import { isOwner, logActivity, isValidPackageName } from '../../utils/security.js';

const execAsync = promisify(exec);

export default {
    name: 'plugin',
    aliases: ['plugin', 'npm'],
    tags: ['owner'],
    description: 'NPM package manager - install, uninstall, list packages',
    access: {
        owner: true,
        group: false,
        private: false
    },

    run: async (sock, msg, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        // Owner check - TEMPORARILY DISABLED FOR DEBUGGING
        // if (!isOwner(sender, config)) {
        //     return sock.sendMessage(from, {
        //         text: "❌ Owner-only command!"
        //     });
        // }

        console.log('[PLUGIN] User:', sender);

        const operation = args[0]?.toLowerCase();

        // Show help if no operation
        if (!operation) {
            return sock.sendMessage(from, {
                text: `📦 *PLUGIN MANAGER*

*Commands:*
• .plugin install [package]
• .plugin uninstall [package]
• .plugin list
• .plugin update [package]

*Examples:*
.plugin install axios
.plugin install baileys
.plugin list
.plugin uninstall axios

⚠️ Installation may take time
🔒 Owner-only access`
            });
        }

        try {
            switch (operation) {
                case 'install':
                case 'i': {
                    const packageName = args[1];

                    if (!packageName) {
                        return sock.sendMessage(from, {
                            text: "❌ Usage: .plugin install [package]"
                        });
                    }

                    // Validate package name
                    if (!isValidPackageName(packageName)) {
                        return sock.sendMessage(from, {
                            text: `❌ Invalid package name: ${packageName}`
                        });
                    }

                    await sock.sendMessage(from, {
                        react: { text: '⏳', key: msg.key }
                    });

                    await sock.sendMessage(from, {
                        text: `📦 Installing ${packageName}...\n\n⏳ Please wait, this may take a while...`
                    });

                    // Install package
                    const { stdout, stderr } = await execAsync(`npm install ${packageName}`, {
                        timeout: 120000, // 2 minutes
                        cwd: process.cwd()
                    });

                    logActivity(sender, `plugin install ${packageName}`, 'Success');

                    await sock.sendMessage(from, {
                        react: { text: '✅', key: msg.key }
                    });

                    return sock.sendMessage(from, {
                        text: `✅ *Package Installed*\n\n📦 ${packageName}\n\n💡 Restart bot to use new package`
                    });
                }

                case 'uninstall':
                case 'remove':
                case 'rm': {
                    const packageName = args[1];

                    if (!packageName) {
                        return sock.sendMessage(from, {
                            text: "❌ Usage: .plugin uninstall [package]"
                        });
                    }

                    await sock.sendMessage(from, {
                        react: { text: '⏳', key: msg.key }
                    });

                    await sock.sendMessage(from, {
                        text: `📦 Uninstalling ${packageName}...`
                    });

                    // Uninstall package
                    const { stdout, stderr } = await execAsync(`npm uninstall ${packageName}`, {
                        timeout: 60000,
                        cwd: process.cwd()
                    });

                    logActivity(sender, `plugin uninstall ${packageName}`, 'Success');

                    await sock.sendMessage(from, {
                        react: { text: '✅', key: msg.key }
                    });

                    return sock.sendMessage(from, {
                        text: `✅ *Package Uninstalled*\n\n📦 ${packageName}`
                    });
                }

                case 'list':
                case 'ls': {
                    await sock.sendMessage(from, {
                        react: { text: '⏳', key: msg.key }
                    });

                    // Get installed packages
                    const { stdout } = await execAsync('npm list --depth=0 --json', {
                        timeout: 30000,
                        cwd: process.cwd()
                    });

                    const data = JSON.parse(stdout);
                    const dependencies = data.dependencies || {};

                    if (Object.keys(dependencies).length === 0) {
                        return sock.sendMessage(from, {
                            text: "📦 No packages installed"
                        });
                    }

                    let output = `📦 *INSTALLED PACKAGES*\n\n`;

                    Object.entries(dependencies).forEach(([name, info]) => {
                        output += `• ${name}@${info.version}\n`;
                    });

                    output += `\n📊 Total: ${Object.keys(dependencies).length} packages`;

                    logActivity(sender, 'plugin list', 'Success');

                    await sock.sendMessage(from, {
                        react: { text: '✅', key: msg.key }
                    });

                    return sock.sendMessage(from, { text: output });
                }

                case 'update': {
                    const packageName = args[1];

                    if (!packageName) {
                        return sock.sendMessage(from, {
                            text: "❌ Usage: .plugin update [package]"
                        });
                    }

                    await sock.sendMessage(from, {
                        react: { text: '⏳', key: msg.key }
                    });

                    await sock.sendMessage(from, {
                        text: `📦 Updating ${packageName}...\n\n⏳ Please wait...`
                    });

                    // Update package
                    const { stdout, stderr } = await execAsync(`npm update ${packageName}`, {
                        timeout: 120000,
                        cwd: process.cwd()
                    });

                    logActivity(sender, `plugin update ${packageName}`, 'Success');

                    await sock.sendMessage(from, {
                        react: { text: '✅', key: msg.key }
                    });

                    return sock.sendMessage(from, {
                        text: `✅ *Package Updated*\n\n📦 ${packageName}\n\n💡 Restart bot to use updated package`
                    });
                }

                default:
                    return sock.sendMessage(from, {
                        text: `❌ Unknown operation: ${operation}\n\n💡 Use .plugin for help`
                    });
            }

        } catch (error) {
            console.error('[Plugin] Error:', error);
            logActivity(sender, `plugin ${operation}`, 'Error', error.message);

            await sock.sendMessage(from, {
                react: { text: '❌', key: msg.key }
            });

            let errorMsg = `❌ Error: ${error.message}`;

            if (error.message.includes('timeout')) {
                errorMsg += '\n\n⏱️ Operation timed out. Package might be too large or network is slow.';
            } else if (error.message.includes('ENOTFOUND') || error.message.includes('404')) {
                errorMsg += '\n\n🔍 Package not found. Check package name.';
            }

            return sock.sendMessage(from, { text: errorMsg });
        }
    }
};
