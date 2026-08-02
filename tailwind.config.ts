import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        panel: "#f7f5ef",
        line: "#ded8cb",
        action: "#0f766e",
        warn: "#b45309"
      }
    }
  },
  plugins: []
};

export default config;
