/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gl: {
          blue:      '#0890f1',
          blueDark:  '#0672c4',
          blueLight: '#17a8e3',
          orange:    '#f6653c',
          orangeLight:'#ff8a66',
          orangeDark: '#d94e27',
        }
      },
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    }
  },
  plugins: []
}
