// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF0EE",
          100: "#FFD5CF",
          200: "#FFB7AD",
          300: "#FF8F82",
          400: "#FF6B5B",
          500: "#FF462D"
        }
      }
    }
  },
  plugins: []
};
