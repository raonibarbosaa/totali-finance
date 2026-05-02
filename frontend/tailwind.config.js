/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#eef2f7',
          100: '#d5dfe9',
          200: '#aabfd3',
          300: '#7a9dbc',
          400: '#4d7ca5',
          500: '#2e5f8c',
          600: '#1e4a72',
          700: '#173857',
          800: '#152740',
          900: '#0d1a2b',
        },
        gold: {
          50:  '#fdf8ee',
          100: '#f8eed2',
          200: '#f0d9a0',
          300: '#e6c06a',
          400: '#daa83d',
          500: '#C9A254',
          600: '#b08535',
          700: '#8f6826',
          800: '#6e4f1c',
          900: '#4d3712',
        },
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
