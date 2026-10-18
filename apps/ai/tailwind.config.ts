import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        vulpine: {
          orange: "#ee7200",
          brass: "#C9A96E",
          coal: "#090806",
          ink: "#11100d",
          panel: "#181511",
          border: "#2a251f",
          muted: "#6b6357",
          dim: "#3a352e",
        },
      },
      boxShadow: {
        ember: "0 18px 60px rgba(238, 114, 0, 0.13)",
      },
    },
  },
  plugins: [],
};

export default config;