import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLAG_CATALOG,LANGUAGE_CODES,validFlagKey,languageName,flagAssetUrl } from './language-catalog';
import { importCvJson } from './cv-json';
import { applyCvVisibility } from './cv-visibility';
test('language and flag catalogues are complete, unique and retain safe SVG provenance',()=>{
  assert.ok(LANGUAGE_CODES.length>=185);
  assert.equal(new Set(LANGUAGE_CODES).size,LANGUAGE_CODES.length);
  assert.equal(FLAG_CATALOG.length,267);
  assert.equal(new Set(FLAG_CATALOG.map(item=>item.code)).size,267);
  for(const flag of FLAG_CATALOG){
    assert.ok(flag.license&&flag.source.startsWith('https://'));
    assert.equal(validFlagKey(`country-${flag.code}`),true);
    const svg=readFileSync(new URL(`../../public/language-flags/${flag.file}`,import.meta.url),'utf8');
    assert.match(svg,/<svg/);
    assert.doesNotMatch(svg,/<script\b|<foreignObject\b|\bon\w+\s*=/i);
  }
  assert.equal(validFlagKey('country-INVALID'),false);
  assert.equal(flagAssetUrl('ar'),'');
  assert.equal(flagAssetUrl('country-ar'),'/api/language-flags/ar.svg');
  assert.equal(languageName('it','fr'),'italien');
});
test('additional languages and flag selections survive JSON roundtrip and visibility',()=>{
  const source={nom_complet:'Test',additional_languages:[{id:'test-it',code:'it',name:'Italien',level:'B2',icon:'country-it'}],language_logos:{fr:{icon:'country-ca'}}};
  const cv=importCvJson(source,'auto').cv;
  assert.deepEqual(cv.additional_languages,source.additional_languages);
  assert.deepEqual(cv.language_logos,source.language_logos);
  assert.deepEqual(importCvJson(JSON.parse(JSON.stringify(cv)),'auto').cv.additional_languages,source.additional_languages);
  assert.deepEqual(applyCvVisibility(cv,{'section.languages':true}).additional_languages,[]);
  assert.deepEqual(applyCvVisibility(cv,{'languages.test-it':true}).additional_languages,[]);
});
