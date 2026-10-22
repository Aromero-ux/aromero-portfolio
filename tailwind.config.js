/** Rebuild after changing classes: npx tailwindcss@3 -i tailwind.input.css -o tailwind.css --minify */
module.exports = {
  content: ["./*.html", "./*.js"],
  theme: { extend: {} },
  plugins: []
};
