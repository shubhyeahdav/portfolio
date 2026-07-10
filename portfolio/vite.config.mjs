// Isolated dev-server config for the portfolio site (static, no build step).
// Run from repo root:  npx vite portfolio --strictPort
export default {
  server: {
    port: 5175,
    strictPort: true,
  },
};
