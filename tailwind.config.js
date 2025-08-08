/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg-primary)",
        bge: "var(--bg-secondary)",
        text: "var(--text-primary)",
        muted: "var(--text-secondary)",
        primary: "var(--primary-color)",
        secondary: "var(--secondary-color)",
        accent: "var(--accent-color)",
        border: "var(--border-color)",
        success: "var(--success-color)",
        warning: "var(--warning-color)",
        error: "var(--error-color)",
      },
      borderRadius: {
        xl: "var(--radius-xl)",
        '2xl': "var(--radius-2xl)",
        full: "var(--radius-full)"
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        '2xl': "var(--shadow-2xl)",
        ring: "var(--ring)"
      },
      backgroundImage: {
        'gradient-primary': "var(--gradient-primary)",
        'gradient-bg': "var(--gradient-bg)",
      }
    },
  },
  plugins: [
    function({ addVariant }) {
      addVariant('hocus', ['&:hover', '&:focus-visible']);
    }
  ],
}

