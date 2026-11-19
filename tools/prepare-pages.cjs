// Cada publicação usa URLs de arquivos diferentes para não reutilizar uma configuração antiga.
const fs=require('node:fs');
const path=require('node:path');
const build=process.env.PAGES_BUILD_ID||process.env.GITHUB_SHA||'local';
if(!/^[A-Za-z0-9_-]{1,64}$/.test(build))throw Error('Identificador de publicação inválido.');
const directory=path.resolve(process.argv[2]||path.join(__dirname,'../public'));
for(const name of ['index.html','sw.js','frota/index.html']){
  const target=path.join(directory,name),source=fs.readFileSync(target,'utf8');
  if(!source.includes('__BUILD_ID__'))throw Error('Marcador de publicação ausente em '+name);
  fs.writeFileSync(target,source.replaceAll('__BUILD_ID__',build));
}
console.log('Versão dos arquivos estáticos: '+build);
