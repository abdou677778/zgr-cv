import { readFile, writeFile, readdir } from 'node:fs/promises';
const output = new URL('../public/language-flags/', import.meta.url);
const pack = new URL('../tmp/flag-catalog/package/', import.meta.url);
const previous = JSON.parse(await readFile(new URL('catalog.json',output),'utf8'));
const catalogue = [];
const names = new Intl.DisplayNames('en',{type:'region'});
for(const file of (await readdir(new URL('flags/4x3/',pack))).sort()){
  if(!/^[a-z]{2}(?:-[a-z]{2,3})?\.svg$/.test(file)) continue;
  const code=file.slice(0,-4), existing=previous.find(x=>x.code===code);
  if(existing) { catalogue.push(existing);continue; }
  const svg=await readFile(new URL(`flags/4x3/${file}`,pack),'utf8');
  if(/<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?:https?:|javascript:)/i.test(svg))throw Error(`Unsafe SVG ${file}`);
  await writeFile(new URL(file,output),svg);
  catalogue.push({code,name:code.includes('-')?code:names.of(code.toUpperCase()),file,
    source:`https://github.com/lipis/flag-icons/blob/v7.6.0/flags/4x3/${file}`,
    original:`https://raw.githubusercontent.com/lipis/flag-icons/v7.6.0/flags/4x3/${file}`,
    license:'MIT',licenseUrl:'https://github.com/lipis/flag-icons/blob/v7.6.0/LICENSE',artist:'flag-icons contributors',attribution:''});
}
await writeFile(new URL('LICENSE-flag-icons.txt',output),await readFile(new URL('LICENSE',pack)));
await writeFile(new URL('catalog.json',output),JSON.stringify(catalogue,null,2)+'\n');
await writeFile(new URL('../src/lib/language-flag-catalog.json',import.meta.url),JSON.stringify(catalogue,null,2)+'\n');
console.log(`${catalogue.length} SVG flags; ${catalogue.filter(x=>x.source.includes('commons.wikimedia')).length} Wikimedia originals`);
