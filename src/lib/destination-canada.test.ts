import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCV} from './cv-types';
import {importCvJson} from './cv-json';
import {activeDestinationFields,destinationHtml,destinationIssues,initialDestinationDraft,normalizeDestinationDraft,prepareDestinationDraft} from './destination-canada';
test('Destination Canada never invents passport identity, consents or six language skills',()=>{
  const draft=initialDestinationDraft({...emptyCV,nom_complet:'Jean Exemple',email:'test@example.com',langues:{...emptyCV.langues,fr:'Courant'}});
  assert.equal(draft.answers['91'],'test@example.com');
  for(const id of ['10','11','108','110','67','68','69','70','71','72','57','58','115'])assert.equal(draft.answers[id],undefined);
  assert.equal(draft.reviewed,false);
});

test('Prefill preserves edited answers, flags long evidence and never silently truncates',()=>{
 const cv={...emptyCV,email:'new@example.com',experiences:[{id:'1',titre:'Mécanicien',employeur:'Garage',dates:'2022–2026',lieu:'',descriptions:['x'.repeat(360)]}],destination_canada_tunis:{formId:'cmumrik1f00v201yp4kzni4ua',schemaVersion:2,answers:{'91':'edited@example.com','87':'','114':'Projet confirmé'},reviewed:true}};
 const {draft,issues}=prepareDestinationDraft(cv);
 assert.equal(draft.answers['91'],'edited@example.com');assert.equal(draft.answers['87'],'');
 assert.equal(draft.answers['114'],'Projet confirmé');assert.equal(draft.reviewed,false);
 assert.ok(draft.answers['112'].length>350);assert.ok(issues.some(i=>i.includes('350')));
});

test('MCP draft accepts sourced proposals without a profile but rejects invented choices and generated consents',()=>{
 const {draft,issues}=prepareDestinationDraft(null,{'112':'Mécanicien automobile.','67':'Excellent','108':"Je suis d'accord",'114':'x'.repeat(251),'unknown':'bad'});
 assert.equal(draft.answers['112'],'Mécanicien automobile.');
 for(const id of ['67','108','114','unknown'])assert.equal(draft.answers[id],undefined);
 assert.ok(issues.some(i=>i.includes('consentement réservé')));
 assert.ok(issues.some(i=>i.includes('limite dépassée')));
 const html=destinationHtml(draft);assert.ok(html.includes("form-action 'none'"));assert.ok(html.includes('ne constitue pas une vérification en direct'));
});
test('Destination Canada applies conditional fields and real text limits',()=>{
  assert.ok(!activeDestinationFields({}).some(f=>f.id==='119'));
  assert.ok(activeDestinationFields({'118':'Oui'}).some(f=>f.id==='119'));
  assert.ok(!activeDestinationFields({}).some(f=>f.id==='42'));
  assert.ok(destinationIssues({'114':'x'.repeat(251)}).some(i=>i.includes('250')));
  assert.ok(destinationIssues({'91':'a@example.com','87':'b@example.com'}).some(i=>i.includes('diffèrent')));
  assert.ok(destinationIssues({'84':'2026-02-30'}).some(i=>i.includes('naissance invalide')));
});
test('Destination Canada import is isolated and exported HTML escapes personal text',()=>{
  const draft=initialDestinationDraft(emptyCV);draft.answers['112']='<script>alert(1)</script>';
  const html=destinationHtml(draft);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('BROUILLON NON SOUMIS'));
  assert.equal(normalizeDestinationDraft({formId:'other',answers:{}}),undefined);
  assert.equal(normalizeDestinationDraft({...draft,reviewed:true})?.reviewed,false);
  assert.equal(importCvJson({...emptyCV,destination_canada_tunis:draft},'auto').cv.destination_canada_tunis?.answers['112'],draft.answers['112']);
});
