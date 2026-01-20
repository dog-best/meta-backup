/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")], // ✅ IMPORTANT
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
