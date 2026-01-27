/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // AQUÍ DEFINIMOS TUS COLORES PERSONALIZADOS
        nexus: {
          dark: '#0B1121',       // Fondo principal
          panel: '#151e32',      // Fondo de tarjetas
          cyan: '#00E5FF',       // Cian Neón
          teal: '#40E0D0',       // Turquesa
          green: '#39FF14',      // Verde Lima
          blue: '#003366',       // Azul Marino
          text: '#E2E8F0',       // Texto principal
          muted: '#94A3B8',      // Texto secundario
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 229, 255, 0.4)',
        'glow-green': '0 0 15px rgba(57, 255, 20, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'cyber-grid': 'linear-gradient(to right, #1f2937 1px, transparent 1px), linear-gradient(to bottom, #1f2937 1px, transparent 1px)',
      }
    },
  },
  plugins: [],
};