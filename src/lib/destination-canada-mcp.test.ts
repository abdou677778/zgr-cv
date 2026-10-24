import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDestinationCanadaContext} from '../../cv-pro-team-clients/lib/destination-canada-preparation';
import {fetchOpportunityJson} from '../../cv-pro-team-clients/lib/public-opportunity-api';

test('MCP uses the internal Worker binding without exposing order data to the public API',async()=>{
 let request:Request|undefined;
 const result=await fetchOpportunityJson('/api/destination-canada/tunis',{}, {
   baseUrl:'https://api.example.test',
   binding:{fetch:async value=>{request=value;return Response.json({status:'unverified',schema:{}});}},
   fetcher:async()=>{throw Error('Public fetch must not be used');},
 });
 assert.equal(result.status,'unverified');assert.equal(request!.method,'GET');
 assert.equal(new URL(request!.url).search,'');assert.equal(await request!.text(),'');
 assert.equal(request!.headers.has('Authorization'),false);
});
const dependencies={getOrder:async()=>({id:'TEST'}),getVersions:async()=>[],readJson:async()=>null,getContract:async()=>({status:'unverified',schema:{}})};
test('MCP rejects an HTML challenge instead of treating it as a public contract',async()=>{
 await assert.rejects(fetchOpportunityJson('/api/destination-canada/tunis',{}, {
   baseUrl:'https://api.example.test',binding:{fetch:async()=>new Response('<html>challenge</html>',{status:403})},
 }),/HTTP 403/);
});
test('MCP explicitly reports a missing JSON profile instead of throwing',async()=>{
 const result=await prepareDestinationCanadaContext('TEST',dependencies);
 assert.deepEqual({status:result.preparationStatus,activeVersion:result.activeVersion,profile:result.profile,saved:result.saved,submitted:result.submitted},
   {status:'missing_profile',activeVersion:null,profile:null,saved:false,submitted:false});
});
test('MCP public API failure returns an unverified snapshot without inventing an opening',async()=>{
 const result=await prepareDestinationCanadaContext('TEST',{...dependencies,getContract:async()=>{throw Error('Network error');}});
 const contract=result.contract;assert.ok(contract);assert.equal(contract.status,'unverified');assert.equal(contract.checkedAt,null);
 assert.equal(result.preparationStatus,'missing_profile');
});
test('MCP unreadable active JSON remains explicit and never reconstructs a profile',async()=>{
 const result=await prepareDestinationCanadaContext('TEST',{...dependencies,getVersions:async()=>[{versionNumber:2,storageKey:'fixture'}],readJson:async()=>{throw Error('Missing R2 object');}});
 assert.ok('preparationStatus' in result);assert.equal(result.preparationStatus,'profile_unreadable');assert.equal(result.profile,null);
});
test('MCP refuses missing orders without querying the contract or other orders',async()=>{
 const result=await prepareDestinationCanadaContext('MISSING',{...dependencies,getOrder:async()=>null,getContract:async()=>{throw Error('Must not run');}});
 assert.deepEqual(result,{error:'Commande introuvable.'});
});
test('MCP returns only the requested active profile without writing any version',async()=>{
 const ids:string[]=[];
 const result=await prepareDestinationCanadaContext('TEST',{
   ...dependencies,getOrder:async id=>{ids.push(id);return {id};},
   getVersions:async id=>{ids.push(id);return [{versionNumber:3,storageKey:'fixture'}];},
   readJson:async()=>({documents:{fr:{titre_poste:'TEST'},en:{titre_poste:'OTHER LANGUAGE'}}}),
 });
 assert.deepEqual(ids,['TEST','TEST']);
 assert.deepEqual(result.profile,{titre_poste:'TEST'});
 assert.equal(result.preparationStatus,'profile_available');assert.equal(result.saved,false);
});
