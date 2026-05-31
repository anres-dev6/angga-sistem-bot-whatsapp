import attp from '../commands/utility/attp.js';
import qc from '../commands/utility/qc.js';
import autostiker from '../commands/utility/autosticker.js';
import toimg from '../commands/utility/toimg.js';

console.log('--- Checking imported command properties ---');
console.log('ATTP Command:', { name: attp.name, aliases: attp.aliases, tags: attp.tags });
console.log('QC Command:', { name: qc.name, aliases: qc.aliases, tags: qc.tags });
console.log('AutoSticker Command:', { name: autostiker.name, aliases: autostiker.aliases, tags: autostiker.tags });
console.log('ToImg Command:', { name: toimg.name, aliases: toimg.aliases, tags: toimg.tags });
console.log('\n✅ All imports compiled and loaded successfully! No syntax errors.');
