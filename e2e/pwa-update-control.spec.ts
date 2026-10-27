import {expect,test} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';

for(const scenario of [{width:1440,fail:false},{width:320,fail:false},{width:1440,fail:true}])
test(`compact update control ${scenario.width}px ${scenario.fail?'storage failure':'safe activation'}`,async({page,context})=>{
  test.setTimeout(45000);
  await page.setViewportSize({width:scenario.width,height:900});
  await context.route('**/src/lib/pwa-client.ts',route=>route.fulfill({contentType:'application/javascript',body:`
    export function usePwaStatus(){return {supported:true,installAvailable:false,installed:false,updateAvailable:true};}
    export async function registerPwa(){}
    export async function promptPwaInstall(){return false;}
    export function activatePwaUpdate(){window.__testPwaActivated=(window.__testPwaActivated||0)+1;return true;}
  `}));
  const user={username:'admin',displayName:'Test',role:'admin',active:true,permissions:{clientsRead:true,clientsWrite:true,aiUse:true,manageUsers:true}};
  await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.startsWith('/api/language-flags/')){
      const file=path.split('/').at(-1)!;
      if(!/^[a-z]{2}\.svg$/.test(file))throw Error('Unexpected fixture');
      await route.fulfill({status:200,contentType:'image/svg+xml',body:await readFile(`public/language-flags/${file}`,'utf8')});return;
    }
    const body=path==='/api/auth/login'?{token:'eyJleHAiOjQxMDI0NDQ4MDB9.signature',user}:path==='/api/auth/session'?{ok:true,user}:path==='/api/clients'?{profiles:[]}:{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/?login=admin');
  await page.getByLabel('Mot de passe').fill('synthetic-test-password');
  await page.getByRole('button',{name:'Se connecter'}).click();
  const update=page.getByRole('button',{name:'Mise à jour disponible',exact:true});
  await expect(update).toBeEnabled();
  await expect(update).toHaveAttribute('title','Votre brouillon est conservé avant l’actualisation.');
  await expect(page.getByText('Nouvelle version disponible.',{exact:true})).toHaveCount(0);
  const box=(await update.boundingBox())!;
  expect(box.height).toBe(28);expect(box.x+box.width).toBeLessThanOrEqual(scenario.width);
  await expect.poll(()=>page.evaluate(()=>Number((window as unknown as {__testPwaActivated?:number}).__testPwaActivated||0))).toBe(0);
  await mkdir('output/header-appearance',{recursive:true});
  await page.locator('header').screenshot({path:`output/header-appearance/pwa-${scenario.width}-${scenario.fail?'failure':'ready'}.png`});
  await page.getByLabel('Couleur personnalisée',{exact:true}).evaluate((input:HTMLInputElement)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'#123456');
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  if(scenario.fail)await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='workspaceDrafts')throw Error('Synthetic storage failure');return original.apply(this,args);};
  });
  await update.click();
  if(scenario.fail){
    await expect(page.getByText(/Actualisation annulée/)).toBeVisible();
    expect(await page.evaluate(()=>Number((window as unknown as {__testPwaActivated?:number}).__testPwaActivated||0))).toBe(0);
    await expect(update).toBeEnabled();
  }else{
    await expect.poll(()=>page.evaluate(()=>Number((window as unknown as {__testPwaActivated?:number}).__testPwaActivated||0))).toBe(1);
    const preserved=await page.evaluate(async()=>{
      const path='/src/lib/client-profile-db.ts';const {getWorkspaceDraft}=await import(/* @vite-ignore */ path);
      const draft=await getWorkspaceDraft('admin');return Object.values(draft.payload.templateColors).includes('#123456');
    });
    expect(preserved).toBe(true);
  }
});
