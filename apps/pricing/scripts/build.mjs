import {readFile,writeFile,mkdir,copyFile,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const template=await readFile(new URL('src/index.html',root),'utf8');
const catalog=JSON.parse(await readFile(new URL('src/catalog.json',root),'utf8'));
let html=template;
await mkdir(new URL('dist/downloads/',root),{recursive:true});
await writeFile(new URL('dist/index.html',root),html);
for(const file of ['app.mjs','pricing.mjs','quote-pdf.mjs','catalog.json','catalog-images.json'])await copyFile(new URL('src/'+file,root),new URL('dist/'+file,root));
await writeFile(new URL('dist/styles.css',root),(await readFile(new URL('src/styles.css',root),'utf8'))+'\n'+(await readFile(new URL('src/workflow.css',root),'utf8')));
await copyFile(new URL('node_modules/pdf-lib/dist/pdf-lib.min.js',root),new URL('dist/pdf-lib.min.js',root));
await copyFile(new URL('assets/proposal-template.pdf',root),new URL('dist/proposal-template.pdf',root));
await writeFile(new URL('dist/robots.txt',root),'User-agent: *\nDisallow: /\n');
await copyFile(new URL('assets/Vulpine_Cabinet_Pricing_Configurator.xlsx',root),new URL('dist/downloads/Vulpine_Cabinet_Pricing_Configurator.xlsx',root));
console.log('Built protected pricing site with '+(catalog.Shaker.length+catalog.Euro.length)+' product records.');

await cp(new URL('assets/catalog-images/',root),new URL('dist/catalog-images/',root),{recursive:true});
