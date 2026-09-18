/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf6ef',
          100: '#f9e8d8',
          200: '#f2cfae',
          300: '#e9af7c',
          400: '#de8848',
          500: '#d06f2b',
          600: '#b85620',
          700: '#93421d',
          800: '#76371e',
          900: '#602f1b',
        },
        char: {
          DEFAULT: '#1a1410',
          raised: '#241c16',
          deep: '#14100c',
          hairline: '#3a2d22',
        },
        ember: {
          DEFAULT: '#e2571b',
          soft: '#f08a4e',
          glow: '#ffb27a',
        },
        bone: {
          DEFAULT: '#f4ede3',
          dim: '#b9a996',
          faint: '#8a7d6e',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        ember: '0 0 0 1px rgba(226,87,27,0.35), 0 8px 30px -12px rgba(226,87,27,0.35)',
      },
      borderRadius: {
        pill: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;