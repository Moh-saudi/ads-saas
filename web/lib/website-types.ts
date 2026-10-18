export type HeroSlide = { title:string; accent:string; eyebrow:string; description:string; image_url:string; alt:string; illustrative?:boolean };
export type WebsitePartner = { name:string; logo_url:string; website:string };
export type WebsitePlace = { name:string; description:string; image_url:string; map_url:string; illustrative?:boolean };
export type WebsiteProject = { title:string; category:string; description:string; image_url:string };
export type WebsiteContent = {
  slides:HeroSlide[]; partners:WebsitePartner[]; places:WebsitePlace[]; projects:WebsiteProject[];
  about_title:string; about_text:string;
};
export { agencyImages, defaultWebsiteContent, resolveWebsiteContent } from "./website-content.mjs";
