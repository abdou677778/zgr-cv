import flags from './language-flag-catalog.json';
export const LANGUAGE_CODES = 'aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu kab'.split(' ');
export const FLAG_CATALOG = flags;
export function languageName(code: string, locale = 'fr') {
  if(code==='kab')return locale==='ar'?'القبائلية':'Kabyle';
  try{return new Intl.DisplayNames([locale],{type:'language'}).of(code)||code;}catch{return code;}
}
export function flagName(code:string,locale='fr') {
  const region=code.replace(/^country-/,'');
  const special:Record<string,string>={'gb-eng':'Angleterre','gb-sct':'Écosse','gb-wls':'Pays de Galles','es-ct':'Catalogne','es-ga':'Galice','es-pv':'Pays basque','xx':'Sans drapeau'};
  if(special[region])return special[region];
  try{return new Intl.DisplayNames([locale],{type:'region'}).of(region.toUpperCase())||region;}catch{return region;}
}
export const flagAssetUrl=(key:string)=>{
  if(!key.startsWith('country-'))return '';
  const code=key.replace(/^country-/,'');
  return flags.some(item=>item.code===code)?`/api/language-flags/${code}.svg`:'';
};
export const validFlagKey=(key:unknown):key is string=>typeof key==='string'&&(/^(fr|en|ar|de|es|kab)$/.test(key)||flags.some(item=>`country-${item.code}`===key));
export const DEFAULT_LANGUAGE_FLAGS:Record<string,string>={it:'it',pt:'pt',zh:'cn',ja:'jp',ko:'kr',ru:'ru',uk:'ua',tr:'tr',nl:'nl',pl:'pl',sv:'se',no:'no',da:'dk',fi:'fi',el:'gr',cs:'cz',ro:'ro',hu:'hu',bg:'bg',hr:'hr',sr:'rs',sk:'sk',sl:'si',he:'il',fa:'ir',hi:'in',ur:'pk',bn:'bd',id:'id',ms:'my',th:'th',vi:'vn',sw:'tz',af:'za',sq:'al',hy:'am',ka:'ge',az:'az',kk:'kz',uz:'uz',ta:'lk',ne:'np',si:'lk',am:'et',so:'so',ha:'ng',yo:'ng',zu:'za',is:'is',ga:'ie',cy:'gb-wls',eu:'es-pv',ca:'es-ct'};
