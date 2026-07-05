import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// During `vite dev`, the Vercel serverless functions in /api are not running.
// Set VITE_API_PROXY to a `vercel dev` URL (e.g. http://localhost:3000) to proxy
// /api requests there while developing the frontend with HMR.
export default defineConfig(() => {
  const apiProxy = process.env.VITE_API_PROXY;
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      // 3000 is in Auth0's Allowed Callback URLs, so local login works too.
      port: 3000,
      ...(apiProxy
        ? {
            proxy: {
              "/api": {
                target: apiProxy,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
  };
});
