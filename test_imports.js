// Test imports for command management system
import { hideCommand, showCommand, isCommandHidden, getHiddenCommands } from './Lib/hidden_commands.js';
import { setCommandTag, getCommandTag, getAllCustomTags } from './Lib/command_tags.js';

console.log('✅ Testing hidden_commands.js imports...');
console.log('  - hideCommand:', typeof hideCommand);
console.log('  - showCommand:', typeof showCommand);
console.log('  - isCommandHidden:', typeof isCommandHidden);
console.log('  - getHiddenCommands:', typeof getHiddenCommands);

console.log('\n✅ Testing command_tags.js imports...');
console.log('  - setCommandTag:', typeof setCommandTag);
console.log('  - getCommandTag:', typeof getCommandTag);
console.log('  - getAllCustomTags:', typeof getAllCustomTags);

console.log('\n✅ Testing hide.js import...');
import hideCmd from './commands/hide.js';
console.log('  - hide command:', hideCmd.name);

console.log('\n✅ Testing show.js import...');
import showCmd from './commands/show.js';
console.log('  - show command:', showCmd.name);

console.log('\n✅ Testing settag.js import...');
import settagCmd from './commands/settag.js';
console.log('  - settag command:', settagCmd.name);

console.log('\n✅ Testing menuowner.js import...');
import menuownerCmd from './commands/menuowner.js';
console.log('  - menuowner command:', menuownerCmd.name);

console.log('\n✅ Testing menu.js import...');
import menuCmd from './commands/menu.js';
console.log('  - menu command:', menuCmd.name);

console.log('\n🎉 All imports successful!');
