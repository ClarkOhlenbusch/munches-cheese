/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'munches-orange': '#FF521B',
        'munches-orange-dark': '#E0400C',
        'munches-cream': '#FFF7E8',
        'munches-ivory': '#FFFDF5',
        'munches-sky': '#2CA8E2',
        'munches-sky-light': '#60C5F8',
        'munches-sky-dark': '#1789C4',
        'munches-yellow': '#FFE042',
        'munches-yellow-warm': '#FFD026',
        'munches-navy': '#0E3A73',
        'munches-navy-dark': '#09254B',
        'munches-green': '#009B66',
        'munches-green-dark': '#007A50',
        'munches-tangerine': '#E85A1E',
      },
      fontFamily: {
        bubble: ['"Fredoka"', '"Titan One"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['monospace'],
      },
      boxShadow: {
        'pop-navy': '6px 6px 0px #0E3A73',
        'pop-navy-lg': '10px 10px 0px #0E3A73',
        'pop-orange': '6px 6px 0px #FF521B',
        'pop-yellow': '6px 6px 0px #FFE042',
      },
      animation: {
        'float-gentle': 'floatGentle 4s ease-in-out infinite',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'wiggle': 'wiggle 2s ease-in-out infinite',
        'marquee': 'marquee 25s linear infinite',
      },
      keyframes: {
        floatGentle: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(0.8deg)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px) rotate(-0.5deg)' },
          '50%': { transform: 'translateY(-12px) rotate(0.5deg)' },
        },
        pulseSubtle: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
