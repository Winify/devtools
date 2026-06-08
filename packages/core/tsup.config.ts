import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'locators/index': 'src/locators/index.ts',
    'element-snapshot': 'src/element-snapshot.ts',
    'element-types': 'src/element-types.ts',
    'element-scripts': 'src/element-scripts.ts',
    'action-mapping': 'src/action-mapping.ts',
    'trace-writer': 'src/trace-writer.ts'
  },
  format: ['esm'],
  dts: true,
  clean: true
})
