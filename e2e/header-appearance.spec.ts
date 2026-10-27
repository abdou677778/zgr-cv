import {expect,test} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';

for(const width of [1440,375,320])test(`compact header appearance controls at ${width}px`,async({page,context})=>{
  await page.setViewportSize({width,height:900});
  const user={username:'admin',displayName:'Test',role:'admin',active:true,permissions:{clientsRead:true,clientsWrite:true,aiUse:true,manageUsers:true}};
  await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.startsWith('/api/language-flags/')){
      const file=path.split('/').at(-1)!;
      if(!/^[a-z]{2}\.svg$/.test(file))throw Error('Unexpected flag fixture');
      await route.fulfill({status:200,contentType:'image/svg+xml',body:await readFile(`public/language-flags/${file}`,'utf8')});return;
    }
    const body=path==='/api/auth/login'?{token:'eyJleHAiOjQxMDI0NDQ4MDB9.signature',user}
      :path==='/api/auth/session'?{ok:true,user}:path==='/api/clients'?{profiles:[]}:{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/?login=admin');
  await page.getByLabel('Mot de passe').fill('synthetic-test-password');
  await page.getByRole('button',{name:'Se connecter'}).click();
  const controls=page.getByTestId('header-appearance-controls');
  const palette=controls.getByRole('group',{name:'Couleur du modèle',exact:true});
  const theme=controls.getByRole('button',{name:'Activer le mode sombre',exact:true});
  const language=controls.getByRole('button',{name:'Langue du document : Français',exact:true});
  await expect(language).toHaveText('Français');
  await expect(page.locator('.zgr-preview-palette')).toHaveCount(0);
  const boxes=await Promise.all([palette,theme,language].map(locator=>locator.boundingBox()));
  for(const box of boxes){expect(box).not.toBeNull();expect(box!.height).toBe(40);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);}
  expect(boxes[0]!.y).toBe(boxes[1]!.y);expect(boxes[1]!.y).toBe(boxes[2]!.y);
  expect(boxes[0]!.x+boxes[0]!.width).toBeLessThan(boxes[1]!.x);
  expect(boxes[1]!.x+boxes[1]!.width).toBeLessThan(boxes[2]!.x);
  await palette.getByRole('button').nth(1).click();
  await expect(palette.getByRole('button').nth(1)).toHaveAttribute('aria-pressed','true');
  const custom=palette.getByLabel('Couleur personnalisée',{exact:true});
  await custom.evaluate((input:HTMLInputElement)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'#123456');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await language.click();
  await expect(page.getByRole('menuitem')).toHaveText(['Français','English','Español','Deutsch','Italiano','中文','العربية']);
  await expect(page.getByRole('menuitem').locator('img')).toHaveCount(7);
  await page.getByRole('menuitem',{name:'English',exact:true}).click();
  await expect(controls.getByRole('button',{name:'Langue du document : English'})).toHaveText('English');
  await controls.getByRole('button',{name:'Langue du document : English'}).click();
  await page.getByRole('menuitem',{name:'Français',exact:true}).click();
  await expect(custom).toHaveValue('#123456');
  await theme.click();
  await expect(controls.getByRole('button',{name:'Activer le mode clair'})).toBeVisible();
  await controls.getByRole('button',{name:'Activer le mode clair'}).click();
  await expect.poll(()=>language.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  await mkdir('output/header-appearance',{recursive:true});
  await page.locator('header').screenshot({path:`output/header-appearance/header-${width}.png`});
});
