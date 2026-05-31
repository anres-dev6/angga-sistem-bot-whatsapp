import { setupFonts } from "./fontHelper.js";

// Bulletproof bootstrap: blocks initialization using ESM top-level await
// until all fonts are validated, downloaded if missing, and registered in Fontconfig
await setupFonts();
