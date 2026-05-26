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

    const files = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));

    for (const file of files) {
        try {
            const filePath = path.join(commandDir, file);
            const fileUrl = pathToFileURL(filePath).href;

            // Import the command file
            // Using timestamp to bypass cache if needed (though dynamic import cache is tricky in ESM)
            const imported = await import(`${fileUrl}?t=${Date.now()}`);
            const cmd = imported.default;

            if (!cmd) continue;

            // If it's the old format (just a function), wrap it or skip?
            // For now, let's assume we are migrating everything or supporting both temporarily?
            // The prompt asks to "rombak" (refactor), so we aim for the new structure.
            // But to avoid breaking valid old commands immediately, we might check type.

            // Standardize command object
            const commandName = cmd.name || file.replace('.js', '');

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
            console.error(chalk.red(`Failed to load command ${file}:`, e));
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
