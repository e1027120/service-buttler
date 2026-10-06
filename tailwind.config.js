/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Church branding colors, injected at runtime as CSS variables (r g b).
        brand: 'rgb(var(--brand-rgb, 79 70 229) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb, 245 158 11) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp .4s ease-out both',
      },
    },
  },
  plugins: [],
};
