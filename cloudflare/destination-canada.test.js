import test from 'node:test';
import assert from 'node:assert/strict';
import {destinationCanadaContract} from './destination-canada.js';
const id='cmumrik1f00v201yp4kzni4ua';
test('Destination Canada reports open only with official notice and matching version',async()=>{
 const result=await destinationCanadaContract(async url=>new Response(url.includes('canada.ca/fr/immigration')?`Les inscriptions pour les participants sont maintenant ouvertes ${id}`:`${id} \\"versionNumber\\":2 \\"closedDetails\\":null \\"isPublished\\":true`));
 assert.equal(result.status,'open');assert.equal(result.deadline.value,null);assert.equal(result.schema.fields.find(f=>f.id==='114').maxLength,250);
});
test('Destination Canada fails closed when official pages are unavailable or changed',async()=>{
 assert.equal((await destinationCanadaContract(async()=>{throw Error('offline')})).status,'unverified');
 assert.equal((await destinationCanadaContract(async()=>new Response('closed'))).status,'review_required');
});
