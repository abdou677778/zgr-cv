import type { Content } from 'pdfmake/interfaces';
import type { CV } from './cv-types';
import type { DocumentLanguage } from './document-language';
import { languageName } from './language-catalog';
export function additionalLanguageRows(cv:CV,language:DocumentLanguage,spacious:boolean,body:(name:string,level:string)=>Content):Content[]{
  const rtl=language==='ar';
  return (cv.additional_languages||[]).filter(item=>item.name.trim()&&item.level.trim()).map((item,index,items)=>{
    const name=item.code&&item.name===languageName(item.code)?languageName(item.code,language):item.name;
    const flag={width:18,...(item.customIconDataUrl?.startsWith('data:image/png')?{image:item.customIconDataUrl,fit:[9.3,9.3] as [number,number]}:{text:''}),alignment:'center',margin:[0,-1.5,0,0]} as Content;
    const text=body(name,item.level);
    return {unbreakable:true,columns:rtl?[text,flag]:[flag,text],columnGap:4,margin:[0,0,0,spacious?(index===items.length-1?0:7):4]} as Content;
  });
}
