/** Source config for the vendored, pre-built vendor/tailwind.css.
 * Rebuild after editing markup/classes with:
 *   npx tailwindcss -i ./src/tailwind-input.css -o ./vendor/tailwind.css --config ./tailwind.config.js --minify
 */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.js"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      animation: { "fade-in": "fadeIn .25s ease-out", "slide-up": "slideUp .3s ease-out" },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
