/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            'code::before': {
              content: '""'
            },
            'code::after': {
              content: '""'
            },
            'blockquote p:first-of-type::before': {
              content: '""'
            },
            'blockquote p:last-of-type::after': {
              content: '""'
            },
            maxWidth: '65ch',
            lineHeight: '1.75',
            '> ul > li': {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            '> ol > li': {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            'h1, h2, h3, h4': {
              marginTop: '2em',
              marginBottom: '1em',
            }
          }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 