import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCV} from './cv-types';
import {importCvJson} from './cv-json';
import {activeDestinationFields,destinationHtml,destinationIssues,initialDestinationDraft,normalizeDestinationDraft} from './destination-canada';
test('Destination Canada never invents passport identity, consents or six language skills',()=>{
  const draft=initialDestinationDraft({...emptyCV,nom_complet:'Jean Exemple',email:'test@example.com',langues:{...emptyCV.langues,fr:'Courant'}});
  assert.equal(draft.answers['91'],'test@example.com');
  for(const id of ['10','11','108','110','67','68','69','70','71','72','57','58','115'])assert.equal(draft.answers[id],undefined);
  assert.equal(draft.reviewed,false);
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
