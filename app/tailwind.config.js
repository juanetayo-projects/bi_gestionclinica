/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clinic: {
          50:  '#edf1fa',
          100: '#d3ddf2',
          200: '#a8bce6',
          300: '#7494d4',
          400: '#4169b8',
          500: '#16468E',  // Azul contraste corporativo
          600: '#0D2D6B',  // Azul corporativo principal
          700: '#0a2454',
          800: '#081b40',
          900: '#05122c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
