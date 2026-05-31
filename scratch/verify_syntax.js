import autostiker from '../commands/utility/autosticker.js';
import toimg from '../commands/utility/toimg.js';
import smeme from '../commands/utility/smeme.js';
import payment from '../commands/utility/payment.js';

console.log('--- Checking imported command properties ---');
console.log('AutoSticker Command:', { name: autostiker.name, aliases: autostiker.aliases, tags: autostiker.tags });
console.log('ToImg Command:', { name: toimg.name, aliases: toimg.aliases, tags: toimg.tags });
console.log('SMeme Command:', { name: smeme.name, aliases: smeme.aliases, tags: smeme.tags });
console.log('Payment Command:', { name: payment.name, aliases: payment.aliases, tags: payment.tags });
console.log('\n✅ All remaining imports compiled and loaded successfully! No syntax errors.');
