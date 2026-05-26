export default {
    OWNER: process.env.OWNER ? process.env.OWNER.split(',').map(v => v.trim()) : ["6285708950373"], // Format: nomor internasional tanpa +, contoh: 6285708950373
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyCU2myK5n6AKNU_ndwFD_skOjXdBDL4knY" // Ganti dengan API key Gemini kamu
};