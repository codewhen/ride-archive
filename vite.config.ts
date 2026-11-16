import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { fs: { deny: ["**/video_full_ride/**", "**/.env*", "**/.git/**"] } },
  build: { sourcemap: true },
});
