import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages sirve bajo /bi_gestionclinica/; en dev local se usa raíz
  base: command === 'build' ? '/bi_gestionclinica/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))

