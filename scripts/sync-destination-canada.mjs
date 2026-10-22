// Extract only public form definitions. Never read an applicant's saved answers.
import { writeFile } from 'node:fs/promises';
const url='https://forms-formulaires.alpha.canada.ca/fr/id/cmumrik1f00v201yp4kzni4ua';
const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);
const html=await response.text();let record;
for(const match of html.matchAll(/self\.__next_f\.push\((\[1,[\s\S]*?)\)<\/script>/g)){
  let text;try{text=JSON.parse(match[1])[1];}catch{continue;}
  const at=text.indexOf('"formRecord":');if(at<0)continue;
  const start=text.indexOf('{',at);let depth=0,quoted=false,escape=false,end=start;
  for(;end<text.length;end++){const c=text[end];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){end++;break;}}
  record=JSON.parse(text.slice(start,end));break;
}
if(!record?.form?.elements?.length)throw new Error('Public form schema unavailable');
const schema={formId:record.id,version:record.versionNumber,checkedAt:new Date().toISOString(),officialUrl:url,isPublished:record.isPublished,closedDetails:record.closedDetails,groups:record.form.groups,layout:record.form.layout,
  fields:record.form.elements.filter(e=>e.type!=='richText').map(e=>({id:String(e.id),type:e.type,label:e.properties.titleFr,required:e.properties.validation?.required===true,maxLength:e.properties.validation?.maxLength||null,choices:(e.properties.choices||[]).map(c=>c.fr).filter(Boolean),conditions:e.properties.conditionalRules||[]})),
  notices:record.form.elements.filter(e=>e.type==='richText').map(e=>({id:String(e.id),text:e.properties.descriptionFr})).filter(e=>e.text&&!e.text.startsWith('$'))};
if(!schema.fields.find(e=>e.id==='114'&&e.maxLength===250)||!schema.fields.find(e=>e.id==='112'&&e.maxLength===350))throw new Error('Form changed: manual review required');
const json=JSON.stringify(schema,null,2)+'\n';
await writeFile(new URL('../src/data/destination-canada-tunis.json',import.meta.url),json);
await writeFile(new URL('../cv-pro-team-clients/assets/destination-canada-tunis.json',import.meta.url),json);
console.log(`Public schema: ${schema.fields.length} fields, version ${schema.version}, checked ${schema.checkedAt}`);
