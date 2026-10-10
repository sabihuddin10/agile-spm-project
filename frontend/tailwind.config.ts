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
      // Fluid type scale (same tiers as the Harmic storefront): text scales with the
      // viewport instead of jumping at breakpoints, so headings and buttons stay
      // compact on phones and grow on desktop. Values live in globals.css.
      fontSize: {
        '2xs': ['var(--text-2xs)', { lineHeight: '1rem' }],
        xs: ['var(--text-xs)', { lineHeight: '1rem' }],
        sm: ['var(--text-sm)', { lineHeight: '1.25rem' }],
        base: ['var(--text-base)', { lineHeight: '1.5rem' }],
        lg: ['var(--text-lg)', { lineHeight: '1.75rem' }],
        xl: ['var(--text-xl)', { lineHeight: '1.75rem' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '2rem' }],
        '3xl': ['var(--text-3xl)', { lineHeight: '2.25rem' }],
        '4xl': ['var(--text-4xl)', { lineHeight: '1.15' }],
        '5xl': ['var(--text-5xl)', { lineHeight: '1.1' }],
        '6xl': ['var(--text-6xl)', { lineHeight: '1.05' }],
      },
    },
  },
  plugins: [],
};

export default config;