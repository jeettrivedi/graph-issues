import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Get git info
const getGitInfo = () => {
  try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    return { commitHash };
  } catch (e) {
    return { commitHash: 'unknown' };
  }
};

// Get package version
const getPackageVersion = () => {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
    );
    return packageJson.version;
  } catch (_) {
    return '0.0.0';
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL || '/',
  build: {
    sourcemap: true,
  },
  define: {
    __VERSION__: JSON.stringify(getPackageVersion()),
    __GIT_HASH__: JSON.stringify(getGitInfo().commitHash),
  },
});
