/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0A66C2', // LinkedIn Blue
        dark: '#1e1e1e',
        darker: '#121212',
      }
    },
  },
  plugins: [],
}
