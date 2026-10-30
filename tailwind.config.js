/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Historic Broyhill console tokens. Same family as the public site
        // (navy #182c3e, gold #c2a15a/#a8853f) so the back office reads as
        // the same building. Body canvas is a chroma-0 off-white, not cream.
        navy: { DEFAULT: "#182c3e", deep: "#10202e", soft: "#243b50" },
        ink: "#1f2a36",
        muted: "#5a6672",
        subtle: "#6f7a85",
        faint: "#b4bcc4",
        line: "#e3e6ea",
        canvas: "#f3f4f6",
        surface: "#ffffff",
        accent: { DEFAULT: "#a8853f", deep: "#8a6a2c", tint: "#f6f0e2", bright: "#c2a15a" },
        info: { DEFAULT: "#35607a", tint: "#e8eff4" },
        success: { DEFAULT: "#2f7d4f", tint: "#e6f2ea" },
        warn: { DEFAULT: "#b7791f", tint: "#fbf3e3" },
        danger: { DEFAULT: "#b83232", tint: "#fbeaea" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        admin: ["var(--font-admin)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
