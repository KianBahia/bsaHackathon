/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // iOS dark system palette — matches Telegram's native feel
        bg:          '#000000',
        surface:     '#1c1c1e',
        elevated:    '#2c2c2e',
        sep:         '#38383a',
        label2:      '#8e8e93',
        // Brand
        ribbit:      '#30d158',
        'ribbit-dark':'#28b44b',
        'tg-blue':   '#2488D8',
      },
      maxWidth: { mobile: '430px' },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
