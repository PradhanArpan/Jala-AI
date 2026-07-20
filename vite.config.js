import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must exactly match the GitHub repo name (case-sensitive)
export default defineConfig({
  plugins: [react()],
  base: '/WIM/',
})
