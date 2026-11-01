import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { target: ['es2017', 'chrome61'], cssTarget: ['chrome61', 'ios18.4'] } });
