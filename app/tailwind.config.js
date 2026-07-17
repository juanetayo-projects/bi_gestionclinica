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
        // Lienzo gris medio-claro para el diseño neumórfico (mismo tono para
        // fondo y tarjetas: el relieve lo dan las sombras, no el color)
        neu: {
          100: '#e9edf3',
          200: '#dde3ec',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Neumorfismo: sombra clara (arriba-izq) + oscura (abajo-der) sobre el mismo bg-neu-100
        neu:            '8px 8px 16px rgba(163,177,198,0.55), -8px -8px 16px rgba(255,255,255,0.85)',
        'neu-sm':       '5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.85)',
        'neu-inset':    'inset 4px 4px 8px rgba(163,177,198,0.55), inset -4px -4px 8px rgba(255,255,255,0.85)',
        'neu-inset-sm': 'inset 2px 2px 5px rgba(163,177,198,0.5), inset -2px -2px 5px rgba(255,255,255,0.85)',
      },
    },
  },
  plugins: [],
}
