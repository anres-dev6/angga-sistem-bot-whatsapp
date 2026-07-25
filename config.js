export default {
    OWNER: process.env.OWNER ? process.env.OWNER.split(',').map(v => v.trim()) : ["6285708950373"], // Format: nomor internasional tanpa +, contoh: 6285708950373
    ANONYMOUS_FORWARD_JID: process.env.ANONYMOUS_FORWARD_JID || "120363422506184822@g.us", // JID Grup WA target (contoh: 120363xxx@g.us) agar chat anonim terstruktur & tidak menyebar
    WA_API_PORT: process.env.WA_API_PORT || 3001,
    FORWARD_SECRET_KEY: process.env.FORWARD_SECRET_KEY || "DPO_SECRET_KEY",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyCU2myK5n6AKNU_ndwFD_skOjXdBDL4knY", // Ganti dengan API key Gemini kamu
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "", // Ganti dengan API key OpenRouter kamu
    BINDERBYTE_API_KEY: process.env.BINDERBYTE_API_KEY || "YOUR_BINDERBYTE_API_KEY", // Ganti dengan API key BinderByte kamu
    RAJAONGKIR_API_KEY: process.env.RAJAONGKIR_API_KEY || "YOUR_RAJAONGKIR_API_KEY" // Ganti dengan API key RajaOngkir kamu
};