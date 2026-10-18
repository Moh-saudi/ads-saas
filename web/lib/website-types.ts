import type { Brand } from "./types";
export type HeroSlide = { title:string; accent:string; eyebrow:string; description:string; image_url:string; alt:string; illustrative?:boolean };
export type WebsitePartner = { name:string; logo_url:string; website:string };
export type WebsitePlace = { name:string; description:string; image_url:string; map_url:string; illustrative?:boolean };
export type WebsiteProject = { title:string; category:string; description:string; image_url:string };
export type WebsiteContent = {
  slides:HeroSlide[]; partners:WebsitePartner[]; places:WebsitePlace[]; projects:WebsiteProject[];
  about_title:string; about_text:string;
};
export const agencyImages = ["/media/agency/city-night.webp","/media/agency/urban-plaza.webp","/media/agency/highway-sunset.webp"];
export function defaultWebsiteContent(brand:Brand, areas:string[]=[]):WebsiteContent {
  return {
    slides:[
      {title:"خلّي علامتك",accent:"جزء من المدينة.",eyebrow:"أفكار كبيرة. حضور أكبر.",description:"من أول نظرة، تبدأ الحكاية. مساحات إعلانية مدروسة، وتنفيذ يليق بالعلامة التي تبنيها.",image_url:agencyImages[0],alt:"تصور إبداعي للوحة إعلانية على طريق حضري ليلًا"},
      {title:"في المكان الصح،",accent:"كل العيون عليك.",eyebrow:"قريب من الناس. حاضر في يومهم.",description:"نختار المساحة التي تقرّب رسالتك من جمهورها، ونرافق حملتك من الفكرة إلى الظهور.",image_url:agencyImages[1],alt:"تصور إبداعي لمساحة إعلانية في ممشى حضري"},
      {title:"رسالتك تستحق",accent:"مساحة أكبر.",eyebrow:"من الطريق، تبدأ الفرصة.",description:"حضور واضح على الطرق والمحاور. دعنا نبحث معك عن الموقع الأنسب لحملتك القادمة.",image_url:agencyImages[2],alt:"تصور إبداعي للوحة طريق عند الغروب"},
    ],
    partners:[],projects:[],
    places:areas.slice(0,12).map((name,i)=>({name,description:"نطاق عمل نخطط فيه لمساحات حملتك. تواصل معنا للتعرف على المواقع والتوفر الفعلي.",image_url:agencyImages[i%3],map_url:""})),
    about_title:"المكان الصح\nبيغيّر كل حاجة.",
    about_text:brand.website_description || "نربط بين الفكرة والمكان. نفهم هدف حملتك، ونساعدك على اختيار المساحة المناسبة، ثم نتابع التفاصيل حتى تظهر رسالتك بالشكل الذي تستحقه.",
  };
}
export function resolveWebsiteContent(brand:Brand, content?:Partial<WebsiteContent>|null,areas:string[]=[]):WebsiteContent {
  const defaults=defaultWebsiteContent(brand,areas);
  return {...defaults,...content,slides:content?.slides?.length?content.slides:defaults.slides,
    partners:content?.partners||[],projects:content?.projects||[],places:content?.places?.length?content.places:defaults.places};
}
