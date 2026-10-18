"use client";
import { useState,useTransition } from "react";
import { Plus,Trash2,ArrowUp,ArrowDown,ImagePlus,ExternalLink } from "lucide-react";
import type { WorkspaceData } from "@/lib/types";
import { resolveWebsiteContent,agencyImages,type WebsiteContent } from "@/lib/website-types";
import { uploadWebsiteImage } from "@/app/website-actions";
import { DataForm } from "./forms";
type Group="slides"|"partners"|"places"|"projects";
const groups:Group[]=["slides","places","projects","partners"];
const names={slides:"شرائح الهيرو",partners:"الشركاء والعملاء",places:"الأماكن ونطاقات العمل",projects:"الأعمال والحملات"};
const limits={slides:8,partners:24,places:12,projects:12};
const fields:Record<Group,[string,string,string?][] >={
 slides:[["title","العنوان"],["accent","السطر المميز"],["eyebrow","العبارة التعريفية"],["alt","وصف الصورة"]],
 partners:[["name","اسم الشريك"],["website","موقع الشريك (اختياري)","url"]],
 places:[["name","اسم المكان"],["map_url","رابط الخريطة (اختياري)","url"]],
 projects:[["title","عنوان العمل"],["category","نوع العمل"]],
};
export function WebsiteEditor({data:d}:{data:WorkspaceData}) {
 const [content,setContent]=useState<WebsiteContent>(()=>resolveWebsiteContent(d.brand,d.website,d.districts.map(x=>x.name)));
 const [uploading,startUpload]=useTransition(),[message,setMessage]=useState("");
 const update=(group:Group,index:number,field:string,value:string|boolean)=>setContent(c=>({...c,[group]:c[group].map((row,i)=>i===index?{...row,[field]:value}:row)}));
 function remove(group:Group,index:number){setContent(c=>({...c,[group]:c[group].filter((_,i)=>i!==index)}));}
 function move(group:Group,index:number,offset:number){setContent(c=>{const rows=[...c[group]];[rows[index],rows[index+offset]]=[rows[index+offset],rows[index]];return {...c,[group]:rows};});}
 function add(group:Group){setContent(c=>({...c,[group]:[...c[group],group==="slides"?{title:"",accent:"",eyebrow:"",description:"",image_url:agencyImages[0],alt:""}:group==="partners"?{name:"",logo_url:"",website:""}:group==="places"?{name:"",description:"",image_url:agencyImages[0],map_url:""}:{title:"",category:"",description:"",image_url:agencyImages[0]}]}));}
 return <section className="card padded website-editor"><div className="card-head"><div><h2>تصميم ومحتوى موقع الشركة</h2><p>السلايدر والأماكن والشركاء والأعمال؛ محتوى مستقل لكل شركة.</p></div><a className="text-button" href={d.demo?"/demo-site":"/"} target="_blank" rel="noreferrer">معاينة <ExternalLink size={16}/></a></div>
  <DataForm kind="website_config" demo={d.demo} disabled={uploading} label="نشر تعديلات الموقع">
   <input type="hidden" name="website_content" value={JSON.stringify(content)}/>
   <div className="notice">أضف الشركاء والحملات التي يحق للشركة نشرها فقط. الصور الافتراضية تصورات إبداعية؛ استبدلها بصور أعمالك الفعلية عند توفرها.</div>
   <label>عنوان نبذة الشركة<textarea maxLength={200} value={content.about_title} onChange={e=>setContent({...content,about_title:e.target.value})}/></label>
   <label>نص نبذة الشركة<textarea maxLength={2500} rows={4} value={content.about_text} onChange={e=>setContent({...content,about_text:e.target.value})}/></label>
   {groups.map(group=><details className="website-editor-group" key={group} open={group==="slides"}><summary>{names[group]} <span>{content[group].length} / {limits[group]}</span></summary>
    {content[group].map((entry,index)=>{const row=entry as unknown as Record<string,string>,imageField=group==="partners"?"logo_url":"image_url",image=row[imageField]||"";return <div className="website-editor-row" key={`${group}-${index}`}>
     <div className="website-editor-row-head"><strong>{row.title||row.name||`عنصر ${index+1}`}</strong><div>
      <button type="button" className="icon-button" aria-label={`رفع ترتيب ${group} ${index+1}`} disabled={index===0||uploading} onClick={()=>move(group,index,-1)}><ArrowUp size={16}/></button>
      <button type="button" className="icon-button" aria-label={`خفض ترتيب ${group} ${index+1}`} disabled={index===content[group].length-1||uploading} onClick={()=>move(group,index,1)}><ArrowDown size={16}/></button>
      <button type="button" className="icon-button" aria-label={`إزالة ${group} ${index+1}`} disabled={uploading||group==="slides"&&content.slides.length===1} onClick={()=>remove(group,index)}><Trash2 size={16}/></button>
     </div></div>
     <div className="form-grid">{fields[group].map(([key,label,type])=><label key={key}>{label}<input value={row[key]||""} type={type||"text"} dir={type==="url"?"ltr":undefined} required={key==="title"||key==="name"} maxLength={type==="url"?2000:200} onChange={e=>update(group,index,key,e.target.value)}/></label>)}</div>
     {group!=="partners" && <label>الوصف<textarea value={row.description} maxLength={1500} rows={2} onChange={e=>update(group,index,"description",e.target.value)}/></label>}
     <div className="website-media-field">{image && <img src={image} alt="معاينة الصورة"/>}<label>رابط الصورة<input type="text" dir="ltr" value={image} onChange={e=>update(group,index,imageField,e.target.value)} placeholder="https://…" maxLength={2000}/></label>
      {(group==="slides"||group==="places") && <label className="check-label"><input type="checkbox" checked={Boolean(row.illustrative ?? image.startsWith("/media/agency/"))} onChange={e=>update(group,index,"illustrative",e.target.checked)}/>الصورة تصور إبداعي وليست صورة موقع فعلي</label>}
      <label className="website-upload"><ImagePlus size={17}/>{uploading?"جارٍ الرفع…":"رفع صورة"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={d.demo||uploading} onChange={e=>{
       const file=e.target.files?.[0];if(!file)return;if(file.size>2097152){setMessage("حجم الصورة الأقصى 2 ميجابايت.");return;}
       setMessage("");const form=new FormData();form.set("image",file);
       const wasIllustrative=Boolean(row.illustrative ?? image.startsWith("/media/agency/"));
       startUpload(async()=>{try{const result=await uploadWebsiteImage(form);if(result.url){update(group,index,imageField,result.url);if(group==="slides"||group==="places")update(group,index,"illustrative",wasIllustrative);}else setMessage(result.error||"تعذر الرفع.");}catch{setMessage("تعذر رفع الصورة. تحقق من الاتصال وأعد المحاولة.");}});
      }}/></label><small>JPG / PNG / WebP حتى 2 ميجابايت. الصور المرفوعة للموقع عامة.</small>
     </div>
    </div>;})}
    <button type="button" className="button secondary" disabled={content[group].length>=limits[group]||uploading} onClick={()=>add(group)}><Plus size={16}/>إضافة {group==="slides"?"شريحة":group==="partners"?"شريك":group==="places"?"مكان":"عمل"}</button>
    {!content[group].length && <small>لن تُعرض أسماء أو أعمال وهمية عند ترك هذا القسم فارغًا.</small>}
   </details>)}
   {message && <p role="alert" className="notice danger">{message}</p>}
  </DataForm>
 </section>;
}
