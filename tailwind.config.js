/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{App,components,services,types,constants}.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Ini adalah kunci untuk mengaktifkan Dark Mode
  theme: {
    extend: {},
  },
  plugins: [],
}
