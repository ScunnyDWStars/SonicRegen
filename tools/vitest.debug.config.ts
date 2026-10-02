import { defineConfig } from 'vitest/config';

// Runs scratch debugging tests in tests/tmp (ignored by git and the main suite).
export default defineConfig({ test: { include: ['tests/tmp/**/*.test.ts'], environment: 'node' } });
