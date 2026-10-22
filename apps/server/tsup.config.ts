import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', seed: 'src/scripts/seed.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Workspace packages are plain TypeScript sources, so bundle them in.
  noExternal: ['@quizmoo/shared'],
})
