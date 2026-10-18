"use client";
import Link from "next/link";
import { useMemo,useState,type CSSProperties } from "react";
import { ArrowLeft,ArrowUpLeft,MapPin,Phone,Mail,PanelsTopLeft,Menu,X,Search } from "lucide-react";
import type { Brand } from "@/lib/types";
import { resolveWebsiteContent,agencyImages,type WebsiteContent } from "@/lib/website-types";
import { EnquiryForm } from "./enquiry-form";
import { HeroSlider } from "./hero-slider";
export type CatalogItem={code:string;street:string;category:string;length_m:number|null;width_m:number|null;faces:number};
export function PublicSite({brand:b,catalog,demo=false,content,areas=[]}:{brand:Brand;catalog:CatalogItem[];demo?:boolean;content?:Partial<WebsiteContent>;areas?:string[]}) {
  const c=resolveWebsiteContent(b,content,areas);
  const [menu,setMenu]=useState(false),[category,setCategory]=useState("all"),[search,setSearch]=useState(""),[assetCode,setAssetCode]=useState("");
  const categories=Array.from(new Set(catalog.map(a=>a.category)));
  const filtered=useMemo(()=>catalog.filter(a=>(category==="all" || a.category===category) && `${a.code} ${a.street}`.toLowerCase().includes(search.toLowerCase())),[catalog,category,search]);
  const phone=b.contact_phone?.replace(/[^+\d]/g,""),wa=b.whatsapp?.replace(/\D/g,"");
  const email=b.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contact_email)?b.contact_email:null;
  const links=[["#about","عن الشركة"],["#places","أماكننا"],["#work","مساحات الإبداع"],["#partners","الشركاء"]];
  const concepts=[
    {title:"حضور بحجم طموحك.",category:"لوحات الطرق",description:"رسالة واضحة ومساحة لا تمرّ دون انتباه.",image_url:agencyImages[0]},
    {title:"أقرب إلى يوم جمهورك.",category:"المساحات الحضرية",description:"الفكرة التي تقابل الناس في تفاصيل يومهم.",image_url:agencyImages[1]},
  ];
  const work=c.projects.length?c.projects:concepts;
  return <div className="agency-site" style={{"--agency-brand":b.primary_color} as CSSProperties}>
    {demo && <div className="agency-demo">معاينة إبداعية · البيانات المعروضة تجريبية <Link href="/demo/login">لوحة الإدارة <ArrowUpLeft size={14}/></Link></div>}
    <div className="agency-hero-wrap">
      <header className="agency-nav">
        <Link href={demo?"/demo-site":"/"} className="agency-logo">{b.logo_url?<img src={b.logo_url} alt=""/>:<span className="agency-logo-mark"><PanelsTopLeft size={26}/></span>}<span>{b.name}<small>OUTDOOR. OUTSTANDING.</small></span></Link>
        <nav aria-label="التنقل الرئيسي" className="agency-desktop-links">{links.map(([href,label])=><a href={href} key={href}>{label}</a>)}</nav>
        <a href="#quote" className="agency-nav-cta">خلّينا نتكلم <ArrowUpLeft size={17}/></a>
        <button className="agency-menu-button" aria-label={menu?"إغلاق قائمة الموقع":"فتح قائمة الموقع"} aria-expanded={menu} aria-controls="agency-mobile-nav" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
      </header>
      {menu && <nav id="agency-mobile-nav" className="agency-mobile-nav" aria-label="قائمة الموقع">{[...links,["#quote","ابدأ حملتك"]].map(([href,label])=><a key={href} href={href} onClick={()=>setMenu(false)}>{label}<ArrowUpLeft size={20}/></a>)}</nav>}
      <HeroSlider slides={c.slides}/>
    </div>
    <div className="agency-statement" aria-label="من الفكرة إلى الشارع"><span>فكرة تُرى.</span><i>✳</i><span>علامة تُذكر.</span><i>✳</i><span>مساحة تصنع الفرق.</span><i>✳</i><span dir="ltr">MAKE YOUR MARK.</span></div>
    <section className="agency-section agency-about" id="about">
      <div className="agency-section-label"><span>01 / عن الشركة</span><span dir="ltr">GOOD PLACES. GREAT IDEAS.</span></div>
      <div className="agency-about-grid"><h2>{c.about_title.split("\n").map((line,i)=><span key={i}>{line}</span>)}</h2>
        <div><span className="agency-small-label">نحن {b.name}</span><p>{c.about_text}</p><a className="agency-text-link" href="#places">تعرّف على أماكننا <ArrowLeft size={20}/></a></div></div>
      <div className="agency-principles">{[["01","نفهم طموحك","حملة تبدأ بهدف واضح وجمهور محدد."],["02","نختار مساحتك","الموقع المناسب جزء أساسي من الفكرة."],["03","نتابع التفاصيل","من تخطيط الظهور إلى متابعة التنفيذ."]].map(([n,title,text])=><div key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></div>)}</div>
    </section>
    <section className="agency-section agency-places" id="places">
      <div className="agency-section-label"><span>02 / أماكننا</span><span dir="ltr">THE RIGHT PLACE TO BE.</span></div>
      <div className="agency-section-heading"><h2>كل مكان،<br/><em>فرصة جديدة.</em></h2><p>نطاقات عملنا نقطة البداية. نساعدك على الوصول للمساحة التي تناسب رسالتك، ونتحقق معك من التوفر والتفاصيل.</p></div>
      <div className="agency-places-grid">{c.places.map((place,i)=>{
        const image=place.image_url||agencyImages[i%agencyImages.length];
        return <article key={`${place.name}-${i}`} className="agency-place-card">
        <img src={image} alt={image.startsWith("/media/agency/")?`تصور إبداعي لنطاق ${place.name}`:place.name} loading="lazy"/>
        <div className="agency-place-gradient"/><span className="agency-place-index" dir="ltr">0{i+1} / EXPLORE</span>
        {(place.illustrative ?? image.startsWith("/media/agency/")) && <span className="agency-place-caption">صورة تصورية</span>}
        <div className="agency-place-content"><span><MapPin size={15}/>نطاق عمل</span><h3>{place.name}</h3><p>{place.description}</p><a href={place.map_url||`https://www.openstreetmap.org/search?query=${encodeURIComponent(place.name+" مصر")}`} target="_blank" rel="noreferrer" aria-label={`استكشف ${place.name} على الخريطة`}><ArrowUpLeft size={22}/></a></div>
      </article>;})}</div>
      {!c.places.length && <div className="agency-empty"><MapPin size={30}/><p>نحدد معك النطاق المناسب لحملتك.</p><a href="#quote">تواصل لتخطيط المواقع <ArrowLeft size={18}/></a></div>}
    </section>
    <section className="agency-work-section" id="work"><div className="agency-section">
      <div className="agency-section-label"><span>03 / {c.projects.length?"أعمالنا":"اتجاهات إبداعية"}</span><span dir="ltr">THINK OUTSIDE. STAND OUT.</span></div>
      <div className="agency-section-heading"><h2>{c.projects.length?"أعمال تتكلّم.":"للفكرة، أكثر من مساحة."}</h2><p>{c.projects.length?"مختارات من الأعمال التي اختارت الشركة مشاركتها.":"تصورات بصرية تُلهم الحملة القادمة. الصور التالية مفاهيم إبداعية، وليست توثيقًا لحملات منفذة."}</p></div>
      <div className="agency-work-grid">{work.map((p,i)=><a key={i} href="#quote" className="agency-work-card"><div className="agency-work-image"><img src={p.image_url||agencyImages[i%3]} alt={p.title} loading="lazy"/><span className="agency-work-arrow"><ArrowUpLeft size={24}/></span></div><div className="agency-work-meta"><div><span>{p.category}</span><h3>{p.title}</h3></div><span dir="ltr">/{String(i+1).padStart(2,"0")}</span></div><p>{p.description}</p></a>)}</div>
    </div></section>
    <section className="agency-section agency-partners" id="partners"><div className="agency-section-label"><span>04 / {c.partners.length?"شركاء النجاح":"الشراكة القادمة"}</span><span dir="ltr">BETTER, TOGETHER.</span></div>
      {c.partners.length?<><div className="agency-section-heading"><h2>نصنع الأثر،<br/><em>معًا.</em></h2><p>علامات وشركاء نعتز بالتعاون معهم.</p></div><div className="agency-partner-grid">{c.partners.map((p,i)=><div className="agency-partner" key={i}>{p.website?<a href={p.website} target="_blank" rel="noreferrer">{p.logo_url?<img src={p.logo_url} alt={p.name} loading="lazy"/>:<strong>{p.name}</strong>}</a>:p.logo_url?<img src={p.logo_url} alt={p.name} loading="lazy"/>:<strong>{p.name}</strong>}</div>)}</div></>:<div className="agency-partner-invitation"><div className="agency-partner-art" aria-hidden="true"><span>YOUR</span><span>BRAND<span className="agency-plus">✳</span></span><span>HERE.</span></div><div><span className="agency-small-label">مساحة لشراكة تستحق.</span><h2>الحكاية القادمة،<br/>ممكن تبدأ معك.</h2><p>نحب العمل مع العلامات الطموحة. شاركنا فكرتك، ولنبحث معًا عن المكان الذي يليق بها.</p><a className="agency-text-link" href="#quote">لنخطط لحضورك القادم <ArrowLeft size={20}/></a></div></div>}
    </section>
    <section className="agency-catalog-section" id="locations"><div className="agency-section"><div className="agency-section-label"><span>05 / دليل المساحات</span><span dir="ltr">FIND YOUR SPOT.</span></div><div className="agency-section-heading"><h2>مساحتك التالية،<br/><em>تبدأ من هنا.</em></h2><p>تصفّح المواقع المنشورة من الشركة. تواصل معنا للتحقق من توفر كل موقع وأسعار الحجز.</p></div>
      {catalog.length>0?<><div className="agency-catalog-toolbar"><div className="agency-filter-chips">{["all",...categories].map(type=><button key={type} aria-pressed={category===type} onClick={()=>setCategory(type)} className={category===type?"is-active":""}>{type==="all"?"كل المساحات":type}</button>)}</div><label className="agency-search"><Search size={18}/><input aria-label="البحث في المواقع المنشورة" placeholder="شارع، منطقة أو كود الموقع" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
      <div className="agency-catalog-grid">{filtered.map((a,i)=><article className="agency-catalog-card" key={a.code}><div className="agency-catalog-art"><img src={agencyImages[i%3]} alt="تصور توضيحي لمساحة إعلانية" loading="lazy"/><span>تصور توضيحي</span><b>{a.category}</b></div><div className="agency-catalog-copy"><span dir="ltr">{a.code}</span><h3>{a.street}</h3><p>{a.length_m||"—"} × {a.width_m||"—"} م <i/> {a.faces} أوجه</p><a href="#quote" onClick={()=>setAssetCode(a.code)}>اطلب تفاصيل الموقع <ArrowUpLeft size={20}/></a></div></article>)}</div>{!filtered.length && <p className="agency-empty">لا توجد مواقع مطابقة. جرّب بحثًا آخر.</p>}</>:<div className="agency-catalog-empty"><div className="agency-coordinate-art" aria-hidden="true"><span/><MapPin size={34}/><span/></div><h3>مكان فكرتك، نختاره معك.</h3><p>دليل المواقع المنشورة قيد التجهيز. أخبرنا بنطاق حملتك لنراجع معك المساحات المتاحة فعلًا.</p><a className="agency-pill agency-pill-dark" href="#quote">اطلب اقتراح مواقع <ArrowLeft size={18}/></a></div>}
    </div></section>
    <section className="agency-contact" id="quote"><div className="agency-section"><div className="agency-section-label"><span>06 / لنبدأ</span><span dir="ltr">LET’S MAKE SOMETHING BIG.</span></div><div className="agency-contact-grid"><div className="agency-contact-copy"><span className="agency-small-label">عندك فكرة؟ نحن نسمعك.</span><h2>خلّينا نعمل<br/><em>حاجة تتشاف.</em></h2><p>{b.address||"دعنا نختار معًا موقع حملتك القادمة."}</p><div className="agency-contact-links">{phone && <a href={`tel:${phone}`}><Phone size={18}/><span dir="ltr">{b.contact_phone}</span><ArrowUpLeft size={18}/></a>}{email && <a href={`mailto:${email}`}><Mail size={18}/><span dir="ltr">{email}</span><ArrowUpLeft size={18}/></a>}{wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><span>تواصل عبر واتساب</span><ArrowUpLeft size={18}/></a>}</div></div><EnquiryForm demo={demo} assetCode={assetCode}/></div></div></section>
    <footer className="agency-footer"><div><strong>{b.name}</strong><span>أفكار كبيرة. حضور أكبر.</span></div><nav aria-label="روابط التذييل"><Link href={demo?"/demo/login":"/login"}>دخول فريق العمل <ArrowUpLeft size={15}/></Link><a href="#about">عن الشركة</a><a href="#places">أماكننا</a></nav><div className="agency-footer-bottom"><span>© {new Date().getFullYear()} {b.name}</span><span dir="ltr">DESIGNED TO MAKE AN IMPACT.</span><span>بدعم من Mesk</span></div></footer>
  </div>;
}
