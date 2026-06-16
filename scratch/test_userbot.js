import { loadUserbots, saveUserbots } from '../Lib/userbot_manager.js';
import addbot from '../commands/owner/addbot.js';
import editbot from '../commands/owner/editbot.js';
import unbot from '../commands/owner/unbot.js';
import gl from '../commands/utility/gl.js';
import listbot from '../commands/owner/listbot.js';

console.log('✅ Lib/userbot_manager.js imports successfully!');
console.log('  - loadUserbots:', typeof loadUserbots);
console.log('  - saveUserbots:', typeof saveUserbots);

console.log('\n✅ Owner Commands import successfully!');
console.log('  - addbot command name:', addbot.name);
console.log('  - editbot command name:', editbot.name);
console.log('  - unbot command name:', unbot.name);
console.log('  - listbot command name:', listbot.name);

console.log('\n✅ Utility Commands import successfully!');
console.log('  - gl command name:', gl.name);

console.log('\n🎉 Multi Userbot compilation and import check passed!');
