import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    open: '/leaderboard.html',
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        leaderboard: 'leaderboard.html',
      },
    },
  },
})