export const agencyImages = ["/media/agency/city-night.webp","/media/agency/urban-plaza.webp","/media/agency/highway-sunset.webp"];
/** @param {import("./types").Brand} brand
 * @param {string[]} areas
 * @returns {import("./website-types").WebsiteContent} */
export function defaultWebsiteContent(brand, areas=[]) {
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
/** @param {import("./types").Brand} brand
 * @param {Partial<import("./website-types").WebsiteContent> | null | undefined} content
 * @param {string[]} areas
 * @returns {import("./website-types").WebsiteContent} */
export function resolveWebsiteContent(brand, content, areas=[]) {
  const defaults=defaultWebsiteContent(brand,areas);
  return {...defaults,...content,slides:content?.slides?.length?content.slides:defaults.slides,
    partners:content?.partners||[],projects:content?.projects||[],places:content?.places ?? defaults.places};
}
