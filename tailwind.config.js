/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        navy: {
          950: '#02040e',
          900: '#050a1a',
          800: '#080e20',
          700: '#0c1428',
          600: '#111c35',
          500: '#162040',
        },
        glass: 'rgba(255,255,255,0.05)',
        'glass-hover': 'rgba(255,255,255,0.08)',
        blue: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          glow: '#3b82f6',
        },
        purple: {
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          glow: '#8b5cf6',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          glow: '#06b6d4',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        'gradient-secondary': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
        'gradient-card': 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))',
        'gradient-glow': 'radial-gradient(circle at center, rgba(139,92,246,0.15), transparent 70%)',
        'neural-grid': "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(59,130,246,0.3)',
        'glow-purple': '0 0 20px rgba(139,92,246,0.3)',
        'glow-cyan': '0 0 20px rgba(6,182,212,0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        'counter': 'counter 1s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-up': 'fadeUp 0.4s ease-out',
        'ripple': 'ripple 0.6s linear',
        'particle': 'particle 8s ease-in-out infinite',
        'neural': 'neural 4s ease-in-out infinite',
        'recording-pulse': 'recordingPulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(139,92,246,0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(139,92,246,0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '0.8' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        particle: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.3' },
          '33%': { transform: 'translate(30px, -20px) scale(1.1)', opacity: '0.6' },
          '66%': { transform: 'translate(-15px, 25px) scale(0.9)', opacity: '0.4' },
        },
        neural: {
          '0%, 100%': { opacity: '0.2', strokeDashoffset: '0' },
          '50%': { opacity: '0.5', strokeDashoffset: '-20' },
        },
        recordingPulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239,68,68,0.4)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 10px rgba(239,68,68,0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '80': '20rem',
        '240': '60rem',
      },
    },
  },
  plugins: [],
}
