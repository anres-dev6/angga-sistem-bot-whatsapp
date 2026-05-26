import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map to store commands
export const commands = new Map();
export const aliases = new Map();

export async function loadCommands(commandDir) {
    // Clear existing commands to allow reload
    commands.clear();
    aliases.clear();

    // Helper function to recursively find all .js files
    const getFilesRecursive = (dir) => {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getFilesRecursive(filePath));
            } else if (file.endsWith('.js')) {
                results.push(filePath);
            }
        });
        return results;
    };

    const files = getFilesRecursive(commandDir);

    for (const filePath of files) {
        try {
            const fileUrl = pathToFileURL(filePath).href;
            const fileBasename = path.basename(filePath);

            // Import the command file
            // Using timestamp to bypass cache if needed
            const imported = await import(`${fileUrl}?t=${Date.now()}`);
            const cmd = imported.default;

            if (!cmd) continue;

            // Standardize command object
            const commandName = cmd.name || fileBasename.replace('.js', '');

            const commandObj = {
                name: commandName,
                run: cmd.run || cmd, // Support old format if it was just export default function
                tags: cmd.tags || ['uncategorized'],
                access: cmd.access || {},
                aliases: cmd.aliases || []
            };

            commands.set(commandName, commandObj);

            if (cmd.aliases && Array.isArray(cmd.aliases)) {
                cmd.aliases.forEach(alias => {
                    aliases.set(alias, commandName);
                });
            }

        } catch (e) {
            console.error(chalk.red(`Failed to load command ${filePath}:`, e));
        }
    }

    console.log(chalk.green(`Loaded ${commands.size} commands`));
}

export function getCommand(name) {
    if (commands.has(name)) {
        return commands.get(name);
    }
    if (aliases.has(name)) {
        return commands.get(aliases.get(name));
    }
    return null;
}
