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
        tremor: {
          background: {
            muted: "#f9fafb",   // gray-50
            subtle: "#f3f4f6",  // gray-100
            DEFAULT: "#ffffff", // white
            emphasis: "#374151",// gray-700
          },
          border: {
            DEFAULT: "#e5e7eb", // gray-200
          },
          content: {
            subtle: "#9ca3af",
            DEFAULT: "#6b7280",
            emphasis: "#374151",
            strong: "#111827",
            inverted: "#ffffff",
          },
        },
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
  plugins: [],
};
