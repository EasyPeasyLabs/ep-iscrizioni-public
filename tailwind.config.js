/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Quicksand', 'sans-serif'],
        heading: ['Fredoka', 'sans-serif'],
        hand: ['Pacifico', 'cursive'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        brand: {
          blue: '#012169', /* Union Jack Blue */
          red: '#C8102E',  /* Union Jack Red */
          yellow: '#F7DA25', /* Lemon Yellow */
        }
      }
    },
  },
  plugins: [],
}
