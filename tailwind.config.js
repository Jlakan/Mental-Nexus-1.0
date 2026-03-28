/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // TEMA GLOBAL NEXUS (Gamificación / Pacientes)
        nexus: {
          dark: '#0B1121',       
          panel: '#151e32',      
          cyan: '#00E5FF',       
          teal: '#40E0D0',       
          green: '#39FF14',      
          blue: '#003366',       
          text: '#E2E8F0',       
          muted: '#94A3B8',      
        },
        // TEMA AGENDA (Clínico / Administrativo)
        agenda: {
          bg: '#f5f5f5',         // Fondo general de la pantalla
          header: '#673AB7',     // Morado de la barra superior
          primary: {
            DEFAULT: '#2196F3',  // Azul principal (botones, bordes)
            dark: '#1565C0',     // Azul oscuro (texto de precios, fechas hoy)
            light: '#E3F2FD',    // Azul muy claro (fondos de turnos disponibles/hoy)
          },
          success: {
            DEFAULT: '#4CAF50',  // Verde (pagado, botones de guardar)
            dark: '#2E7D32',     // Verde oscuro (texto de turnos libres)
            light: '#E8F5E9',    // Verde muy claro (fondo de turnos pagados)
            soft: '#F1F8E9',     // Verde pastel (fondo de turno disponible en el día)
          },
          danger: {
            DEFAULT: '#D32F2F',  // Rojo (bloqueos, cancelaciones, iconos de borrar)
            light: '#FFEBEE',    // Rojo muy claro (fondo de turnos bloqueados)
            border: '#FFCDD2',   // Borde rojo claro
          },
          waitlist: {
            DEFAULT: '#9C27B0',  // Morado secundario (botones de lista de espera)
            dark: '#7B1FA2',     // Morado oscuro (resolución de conflictos)
          },
          text: {
            dark: '#222222',     // Texto muy oscuro (nombres de pacientes)
            DEFAULT: '#333333',  // Texto estándar
            muted: '#555555',    // Texto secundario (horas, notas)
            light: '#777777',    // Texto claro (días pasados, placeholders)
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 229, 255, 0.4)',
        'glow-green': '0 0 15px rgba(57, 255, 20, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'agenda-card': '0 2px 5px rgba(0,0,0,0.1)',
        'agenda-modal': '0 10px 25px rgba(0,0,0,0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'cyber-grid': 'linear-gradient(to right, #1f2937 1px, transparent 1px), linear-gradient(to bottom, #1f2937 1px, transparent 1px)',
      }
    },
  },
  plugins: [],
};