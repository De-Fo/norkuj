import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // MapLibre is the single largest dependency (~1.5MB). Keep it in its
          // own chunk so the app shell doesn't block on it and browsers can
          // cache it across deploys (the map code rarely changes).
          if (id.includes('maplibre-gl')) return 'maplibre'
          // React + core stay cached separately from app code.
          if (id.includes('node_modules/react') || id.includes('node_modules/@supabase')) return 'vendor'
        },
      },
    },
  },
})