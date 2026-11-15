import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig(({ mode }) => ({
  plugins: [solid()],
  server: {
    port: 3000,
    // Stored local asset paths stay portable across deployments. During split
    // API/frontend development, serve them from the configured API's origin.
    proxy: {
      '/uploads': {
        target: new URL(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL || 'http://localhost:8080/api/v1', 'http://localhost:8080').origin,
        changeOrigin: true,
      },
    },
  },
}))
