import { CLIENTS_API_ENDPOINT } from "./auth-client";
import type { CompanyLogo, CV } from "./cv-types";
import { ORGANIZATIONS } from "../data/organization-catalog";
import { replaceSharedSoftwareLogo } from "./shared-software-logos";
export { ORGANIZATIONS };
const endpoint=CLIENTS_API_ENDPOINT.replace(/\/clients$/, "/organization-logos");
let overrides: Record<string,string>={};
let loading: Promise<void>|undefined;
export function loadOrganizationLogos(force=false) {
  if(!loading||force)loading=fetch(endpoint,{cache:"no-store"}).then(async r=>{
    if(!r.ok)throw new Error("Bibliothèque indisponible");
    overrides=(await r.json()).logos||{};
    window.dispatchEvent(new Event("zgr-organization-logos"));
  }).catch(()=>{loading=undefined;});
  return loading;
}
export function organizationLogoUrl(id:string){
  const item=ORGANIZATIONS.find(item=>item.id===id);
  return overrides[id]||(item?.asset?`/organization-logos/${item.asset}`:"");
}
export async function organizationLogo(id:string):Promise<CompanyLogo|undefined>{
  const source=organizationLogoUrl(id);if(!source)return undefined;
  const image=new Image();image.src=source;await image.decode();
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Conversion impossible");
  const scale=224/Math.max(image.naturalWidth,image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,(256-w)/2,(256-h)/2,w,h);
  return {catalogId:id,dataUrl:canvas.toDataURL("image/png"),name:`${id}.png`,width:256,height:256};
}
export async function saveOrganizationLogo(id:string,file:File){
  await replaceSharedSoftwareLogo(id,file,endpoint);await loadOrganizationLogos(true);
  return organizationLogo(id);
}
export async function prepareOrganizationLogos(cv:CV):Promise<CV>{
  await loadOrganizationLogos();
  const resolve=async<T extends {logo?:CompanyLogo}>(item:T):Promise<T>=>{
    if(!item.logo?.catalogId)return item;
    try{return {...item,logo:await organizationLogo(item.logo.catalogId)||item.logo};}catch{return item;}
  };
  return {...cv,experiences:await Promise.all(cv.experiences.map(resolve)),formations:await Promise.all(cv.formations.map(resolve)),educations:await Promise.all(cv.educations.map(resolve))};
}
