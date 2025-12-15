import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl()],
  base: '/humanshaders/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    open: true
  }
});
