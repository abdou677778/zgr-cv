import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPwaUpdateAfterSaving} from './pwa-update-safety';
test('PWA update waits for local persistence before activating',async()=>{
  const events:string[]=[];
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const result=applyPwaUpdateAfterSaving(async()=>{events.push('saving');await pending;events.push('saved');},()=>{events.push('activate');return true;});
  assert.deepEqual(events,['saving']);release();
  assert.equal(await result,true);
  assert.deepEqual(events,['saving','saved','activate']);
});
test('failed persistence prevents activation and a missing worker is reported',async()=>{
  let activated=false;
  await assert.rejects(()=>applyPwaUpdateAfterSaving(async()=>{throw Error('storage failed');},()=>{activated=true;return true;}),/storage failed/);
  assert.equal(activated,false);
  assert.equal(await applyPwaUpdateAfterSaving(async()=>{},()=>false),false);
});
