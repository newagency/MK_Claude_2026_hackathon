import headlessui from "@headlessui/tailwindcss";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-text": "#64748b",
        "brand-text-h": "#0f172a",
        "custom-bg": "var(--bg)", 
      },
    },
  },
  safelist: [
    {
      pattern: /^(stroke|fill|bg|text)-(indigo|cyan|amber|rose|emerald|teal|violet|lime|pink|gray)-(500)$/,
    },
  ],
  plugins: [headlessui],
};