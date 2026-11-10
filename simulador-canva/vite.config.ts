import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
// Evidencia de bundle (issue editor): `npm run analyze` (vite build
// --mode analyze) genera `dist/stats.html` (Rollup Visualizer) para
// verificar que el chunk del editor no supera 2.5 MB sin comprimir
// (~800 kB por red). En build normal el plugin no se carga.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    ...(mode === 'analyze'
      ? [
          visualizer({
            filename: 'dist/stats.html',
            open: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@domain-types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
    },
  },
  build: {
    // El chunk diferido del editor debe quedar por debajo de este
    // aviso; con @monaco-editor/react (runtime por CDN) el chunk
    // propio es de pocos kB y el runtime no se empaqueta.
    chunkSizeWarningLimit: 2500,
  },
}))
