// Download original Wikimedia SVGs and retain per-file provenance/licensing.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const codes = 'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw'.split(' ');
const exceptions = { gb:'the United Kingdom', us:'the United States', cd:'the Democratic Republic of the Congo', cg:'the Republic of the Congo', ci:"Côte d'Ivoire", cz:'the Czech Republic', do:'the Dominican Republic', cf:'the Central African Republic', ae:'the United Arab Emirates', nl:'the Netherlands', ph:'the Philippines', mh:'the Marshall Islands', sb:'the Solomon Islands', km:'the Comoros', fm:'the Federated States of Micronesia', mv:'the Maldives', sc:'Seychelles', va:'Vatican City', ps:'Palestine', tw:'the Republic of China', kr:'South Korea', kp:'North Korea', sz:'Eswatini', cv:'Cape Verde', tr:'Turkey', mm:'Myanmar', tl:'East Timor', bo:'Bolivia', tz:'Tanzania', ve:'Venezuela', bn:'Brunei', la:'Laos', sy:'Syria', ir:'Iran', ru:'Russia', vn:'Vietnam', md:'Moldova', fk:'the Falkland Islands', fo:'the Faroe Islands', ck:'the Cook Islands', tc:'the Turks and Caicos Islands', vg:'the British Virgin Islands', vi:'the United States Virgin Islands', mp:'the Northern Mariana Islands', cc:'the Cocos (Keeling) Islands', ky:'the Cayman Islands', io:'the British Indian Ocean Territory' };
const names = new Intl.DisplayNames('en', {type:'region'});
const output = new URL('../public/language-flags/', import.meta.url);
await mkdir(output,{recursive:true});
const catalogue = [];
const missing = [];
for(let offset=0;offset<codes.length;offset+=30){
  const batch=codes.slice(offset,offset+30);
  const titles=batch.map(code=>`File:Flag of ${exceptions[code]||names.of(code.toUpperCase())}.svg`);
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  url.search=new URLSearchParams({action:'query',format:'json',redirects:'1',prop:'imageinfo',iiprop:'url|extmetadata',iilimit:'1',titles:titles.join('|')}).toString();
  const response=await fetch(url,{headers:{'User-Agent':'ZGR-CV-Flag-Catalog/1.0 (Wikimedia Commons attribution retained)'}});
  if(!response.ok) throw Error(`Wikimedia ${response.status}`);
  const result=await response.json();
  const pages=Object.values(result.query?.pages||{});
  const normalized=new Map((result.query?.normalized||[]).map(x=>[x.from,x.to]));
  const redirected=new Map((result.query?.redirects||[]).map(x=>[x.from,x.to]));
  for(let i=0;i<batch.length;i++){
    const code=batch[i];let title=normalized.get(titles[i])||titles[i];title=redirected.get(title)||title;
    const page=pages.find(x=>x.title===title),info=page?.imageinfo?.[0];
    if(!info?.url || !decodeURIComponent(new URL(info.url).pathname).endsWith('.svg')){missing.push(code);console.log('Unavailable title',code,title);continue;}
    const downloadUrl = new URL(info.url); downloadUrl.search = '';
    let svg;
    try { svg = await readFile(new URL(`${code}.svg`,output),'utf8'); } catch {}
    const asset=svg ? null : await fetch(downloadUrl);
    if(asset && !asset.ok){missing.push(code);console.log('Download',code,asset.status); if(asset.status===429) await delay(5000); continue;}
    svg ||= await asset.text();
    if(!svg.includes('<svg') || /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?:https?:|javascript:)/i.test(svg)){missing.push(code);console.log('Unsafe SVG',code);continue;}
    await writeFile(new URL(`${code}.svg`,output),svg);
    const metadata=info.extmetadata||{};
    catalogue.push({code,name:names.of(code.toUpperCase()),file:`${code}.svg`,source:info.descriptionurl,original:info.url,license:metadata.LicenseShortName?.value||'See source',licenseUrl:metadata.LicenseUrl?.value||'',artist:metadata.Artist?.value||'',attribution:metadata.Attribution?.value||''});
    if (asset) await delay(350);
  }
  console.log(`${catalogue.length} SVG downloaded; ${missing.length} unavailable`);
}
catalogue.sort((a,b)=>a.code.localeCompare(b.code));
await writeFile(new URL('catalog.json',output),JSON.stringify(catalogue,null,2)+'\n');
console.log(JSON.stringify({downloaded:catalogue.length,missing}));
