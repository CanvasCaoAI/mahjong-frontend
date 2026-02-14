import { defineConfig } from 'vite';

// Deploy under a sub-path (e.g. /majiang/) on static hosting.
// Use relative base so built index.html references assets like "./assets/..."
// and works no matter which folder it is served from.
export default defineConfig({
  base: './',
});
