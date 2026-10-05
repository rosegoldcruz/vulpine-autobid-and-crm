import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'))
const target = join(process.cwd(), 'public/viewers/pdf')
await mkdir(target, { recursive: true })
await cp(join(pdfRoot, 'build/pdf.worker.min.mjs'), join(target, 'pdf.worker.min.mjs'))
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) await cp(join(pdfRoot, folder), join(target, folder), { recursive: true })
const modelRequire = createRequire(require.resolve('@google/model-viewer'))
const threeRoot = dirname(dirname(modelRequire.resolve('three')))
for (const folder of ['draco/gltf', 'basis']) {
  await cp(join(threeRoot, 'examples/jsm/libs', folder), join(process.cwd(), 'public/viewers/model', folder), { recursive: true })
}

await cp(join(dirname(require.resolve('xlsx')), 'dist/xlsx.full.min.js'), join(process.cwd(), 'public/viewers/xlsx.full.min.js'))

// model-viewer loads its optional decoder as a classic script.
const meshopt = await readFile(join(threeRoot, 'examples/jsm/libs/meshopt_decoder.module.js'), 'utf8')
await writeFile(join(process.cwd(), 'public/viewers/model/meshopt_decoder.js'), meshopt.replace('export { MeshoptDecoder };', ''))
