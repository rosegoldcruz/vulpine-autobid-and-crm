import {readFile,writeFile,mkdir,copyFile,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const template=await readFile(new URL('src/index.html',root),'utf8');
const catalog=JSON.parse(await readFile(new URL('src/catalog.json',root),'utf8'));
let html=template;
await mkdir(new URL('dist/downloads/',root),{recursive:true});
await writeFile(new URL('dist/index.html',root),html);
for(const file of ['app.mjs','studio-shell.mjs','pricing.mjs','quote-pdf.mjs','catalog.json','catalog-images.json'])await copyFile(new URL('src/'+file,root),new URL('dist/'+file,root));
await writeFile(new URL('dist/styles.css',root),(await readFile(new URL('src/styles.css',root),'utf8'))+'\n'+(await readFile(new URL('src/workflow.css',root),'utf8')));
await copyFile(new URL('node_modules/pdf-lib/dist/pdf-lib.min.js',root),new URL('dist/pdf-lib.min.js',root));
await copyFile(new URL('assets/proposal-template.pdf',root),new URL('dist/proposal-template.pdf',root));
await writeFile(new URL('dist/robots.txt',root),'User-agent: *\nDisallow: /\n');
await copyFile(new URL('assets/Vulpine_Cabinet_Pricing_Configurator.xlsx',root),new URL('dist/downloads/Vulpine_Cabinet_Pricing_Configurator.xlsx',root));
console.log('Built protected pricing site with '+(catalog.Shaker.length+catalog.Euro.length)+' product records.');

await cp(new URL('assets/catalog-images/',root),new URL('dist/catalog-images/',root),{recursive:true});
await cp(new URL('assets/brand/',root),new URL('dist/brand/',root),{recursive:true});

await copyFile(new URL('node_modules/xlsx/dist/xlsx.full.min.js',root),new URL('dist/xlsx.full.min.js',root));
await copyFile(new URL('src/quote-xlsx.mjs',root),new URL('dist/quote-xlsx.mjs',root));
await cp(new URL('assets/plan-studio/',root),new URL('dist/studio/',root),{recursive:true});
// Deployment shell only; the supplied Studio source and compiled app stay intact.
const studioPath=new URL('dist/studio/index.html',root);
const studioNav='<nav aria-label="Pricing workspace" style="height:48px;display:flex;align-items:center;gap:18px;padding:0 16px;background:#17212b;color:#fff;font:14px system-ui;border-bottom:1px solid #46515d"><a href="../index.html" style="color:#fff;text-decoration:none;padding:8px 14px">Pricing</a><span aria-current="page" style="background:#fff;color:#17212b;border-radius:6px;padding:8px 14px">Plan Studio</span><span style="font-size:11px">Saved on this device · Export backups in Studio</span></nav>';
await writeFile(studioPath,(await readFile(studioPath,'utf8')).replace('<body>','<body>'+studioNav).replace('<div id="root">','<div id="root" style="height:calc(100% - 48px)">'));
