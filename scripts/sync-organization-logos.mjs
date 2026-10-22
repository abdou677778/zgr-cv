import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const companies = [
  ["Sonatrach","sonatrach.com"],["Sonelgaz","sonelgaz.dz"],["Algérienne des Eaux (ADE)","ade.dz"],["Algérie Télécom","algerietelecom.dz"],
  ["Mobilis","mobilis.dz"],["Djezzy","djezzy.dz"],["Ooredoo Algérie","ooredoo.dz"],["Air Algérie","airalgerie.dz"],
  ["Tassili Airlines","tassiliairlines.dz"],["Algérie Poste","poste.dz"],["SNTF","sntf.dz"],["ENTMV Algérie Ferries","algerieferries.dz"],
  ["Cevital","cevital.com"],["Condor","condor.dz"],["IRIS","iris.dz"],["ENIEM","eniem.com.dz"],
  ["ENIE","enie.dz"],["ENIEM Électroménager","eniem.com.dz"],["Brandt Algérie","brandt.dz"],["Bomare Stream","bomarecompany.com"],
  ["SAIDAL","saidalgroup.dz"],["Biopharm","biopharmdz.com"],["Hikma Algérie","hikma.com"],["Groupe Santé BEKER","bekerlaboratoires.com"],
  ["GICA","gica.dz"],["Lafarge Algérie","lafarge.dz"],["Cosider","cosider-groupe.dz"],["BATIMETAL","batimetal.dz"],
  ["SNVI","snvigroupe.dz"],["ENMTP","enmtp.com"],["Groupe IMETAL","imetal.dz"],["Sider El Hadjar","sider-elhadjar.dz"],
  ["Tosyali Algérie","tosyali-algerie.com"],["Algerian Qatari Steel","aqs.dz"],["Fertial","fertial-dz.com"],["Asmidal","asmidal.dz"],
  ["ENGCB","gcb.dz"],["ENAFOR","enafor.dz"],["ENTP","entp.dz"],["ENSP","ensp.dz"],
  ["NAFTAL","naftal.dz"],["HYPROC","hyproc.dz"],["SOGRAL","sogral.dz"],["ETUSA","etusa.dz"],
  ["BNA","bna.dz"],["BEA","bea.dz"],["Banque CPA","cpa-bank.dz"],["BADR Banque","badrbanque.dz"],
  ["CNEP-Banque","cnepbanque.dz"],["Banque Al Baraka Algérie","albaraka-bank.dz"],["Banque Al Salam Algérie","alsalamalgeria.com"],["SAA Assurances","saa.dz"],
  ["CAAR Assurances","caar.dz"],["CAAT Assurances","caat.dz"],["Alliance Assurances","allianceassurances.com.dz"],["NCA Rouiba","rouiba.com.dz"],
  ["Soummam","soummam-dz.com"],["Hamoud Boualem","hamoud-boualem.com"],["Groupe Benamor","benamor-group.com"],["SIM Agro","groupesim.com"],
];
// Separate legal entities only: replace the duplicate ENIEM wording.
companies[17] = ["Groupe ENPEC", "enpec.dz"];
const institutions = [
  ["USTHB","usthb.dz"],["Université d'Alger 1 Benyoucef Benkhedda","univ-alger.dz"],
  ["Université d'Alger 2 Abou El Kacem Saâdallah","univ-alger2.dz"],["Université d'Alger 3 Ibrahim Sultan Cheibout","univ-alger3.dz"],
  ["Université Badji Mokhtar Annaba","univ-annaba.dz"],["Université Constantine 1 Frères Mentouri","umc.edu.dz"],
  ["Université Ferhat Abbas Sétif 1","univ-setif.dz"],["Université Abderrahmane Mira Béjaïa","univ-bejaia.dz"],
  ["Université Mouloud Mammeri Tizi Ouzou","ummto.dz"],["Université Abou Bekr Belkaïd Tlemcen","univ-tlemcen.dz"],
  ["Université Oran 1 Ahmed Ben Bella","univ-oran1.dz"],["Université Oran 2 Mohamed Ben Ahmed","univ-oran2.dz"],
  ["Université Blida 1 Saad Dahlab","univ-blida.dz"],["Université Mohamed Boudiaf M'Sila","univ-msila.dz"],
  ["Université Kasdi Merbah Ouargla","univ-ouargla.dz"],["Université Mohamed Khider Biskra","univ-biskra.dz"],
  ["École Nationale Polytechnique (ENP)","enp.edu.dz"],["École Nationale Supérieure d'Informatique (ESI)","esi.dz"],
  ["École des Hautes Études Commerciales (EHEC)","hec.dz"],["École Supérieure de Commerce (ESC)","esc-alger.dz"],
  ["INSFP — formation professionnelle","mfep.gov.dz"],["CFPA — formation professionnelle","mfep.gov.dz"],
  ["INSIM","insim.dz"],["MDI Algiers Business School","mdi-algiers.com"],
  ["ESAA École Supérieure Algérienne des Affaires","esaa.dz"],["ESG École Supérieure de Gestion","esg.dz"],
];
const folder = path.join(root, "public/organization-logos"); await mkdir(folder, { recursive: true });
const entries = [...companies.map(([name,domain])=>({name,domain,category:"company"})),
  ...institutions.map(([name,domain])=>({name,domain,category:"education"})),
  ...["TechNova Solutions","DigitalDZ Studio","Startup InnovIT"].map(name=>({name,domain:"",category:"example"}))]
  .map((item,index)=>({...item,id:`dz-${index+1}`,asset:""}));
let cursor=0;
try {
  const previous=JSON.parse(await readFile(path.join(folder,"manifest.json"),"utf8"));
  for(const item of entries){const old=previous.find(p=>p.id===item.id&&p.name===item.name&&p.asset);if(old)Object.assign(item,old);}
} catch {}
async function retrieve(item) {
  if (!item.domain || item.asset) return;
  const base=`https://${item.domain}`; let urls=[];
  try {
    const response=await fetch(base,{signal:AbortSignal.timeout(6000)}); const html=await response.text();
    for(const tag of html.match(/<link\b[^>]*>/gi)||[]) {
      const rel=tag.match(/\brel=["']([^"']+)["']/i)?.[1]; const href=tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      if(rel&&/(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test(rel)&&href) urls.push(new URL(href.replace(/&amp;/g,"&"),response.url||base).href);
    }
  } catch {}
  urls.push(`${base}/favicon.ico`,`${base}/favicon.png`);
  if(!item.domain.startsWith("www.")) {
    try {
      const alt=`https://www.${item.domain}`;
      const r=await fetch(alt,{signal:AbortSignal.timeout(5000)});const html=await r.text();
      for(const tag of html.match(/<(?:link|img)\b[^>]*>/gi)||[]){
        const href=tag.match(/(?:href|src)=["']([^"']+)["']/i)?.[1];
        if(href&&/icon|logo/i.test(tag))urls.push(new URL(href,r.url||alt).href);
      }
      urls.push(`${alt}/favicon.ico`);
    }catch{}
  }
  for(const source of [...new Set(urls)].slice(0,7)) {
    try {
      const r=await fetch(source,{signal:AbortSignal.timeout(5000)}); if(!r.ok)continue;
      const bytes=new Uint8Array(await r.arrayBuffer()); if(bytes.length>500000)continue;
      const head=new TextDecoder().decode(bytes.slice(0,300));
      const ext=bytes[0]===137&&bytes[1]===80?"png":bytes[0]===0&&bytes[2]===1?"ico":/<svg[\s>]/i.test(head)?"svg":"";
      if(!ext)continue;
      item.asset=`${item.id}.${ext}`;item.source=source;
      await writeFile(path.join(folder,item.asset),bytes);return;
    } catch {}
  }
}
await Promise.all(Array.from({length:12},async()=>{while(cursor<entries.length)await retrieve(entries[cursor++]);}));
await writeFile(path.join(folder,"manifest.json"),JSON.stringify(entries,null,2));
await writeFile(path.join(root,"src/data/organization-catalog.ts"),
  `export type Organization = { id: string; name: string; domain: string; category: string; asset: string; source?: string };\nexport const ORGANIZATIONS: readonly Organization[] = ${JSON.stringify(entries,null,2)};\n`);
console.log(JSON.stringify({companies:companies.length,institutions:institutions.length,logos:entries.filter(i=>i.asset).length,total:entries.length}));
