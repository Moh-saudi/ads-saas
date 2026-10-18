"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowDown, Pause, Play } from "lucide-react";
import type { HeroSlide } from "@/lib/website-types";
export function HeroSlider({slides}:{slides:HeroSlide[]}) {
  const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[hover,setHover]=useState(false),[reduced,setReduced]=useState(false),[hidden,setHidden]=useState(false);
  const current=Math.min(index,slides.length-1), slide=slides[current];
  useEffect(()=>{
    const query=window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion=()=>setReduced(query.matches), visibility=()=>setHidden(document.hidden);
    motion();visibility();query.addEventListener("change",motion);document.addEventListener("visibilitychange",visibility);
    return()=>{query.removeEventListener("change",motion);document.removeEventListener("visibilitychange",visibility);};
  },[]);
  const running=!paused && !hover && !reduced && !hidden && slides.length>1;
  useEffect(()=>{
    if(!running)return;
    const timer=window.setTimeout(()=>setIndex(i=>(i+1)%slides.length),6500);
    return()=>window.clearTimeout(timer);
  },[current,running,slides.length]);
  const go=(i:number)=>{setIndex((i+slides.length)%slides.length);setPaused(true);};
  if(!slide)return null;
  return <section className="agency-hero" aria-roledescription="عارض شرائح" aria-label="أفكار وحضور علامتك"
    onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setPaused(true)}
    onKeyDown={e=>{if(e.key==="ArrowLeft"){e.preventDefault();go(current+1);}if(e.key==="ArrowRight"){e.preventDefault();go(current-1);}}}>
    <div className="agency-hero-images" aria-hidden="true">{slides.map((s,i)=><img key={i} src={s.image_url} alt="" className={current===i?"is-active":""} loading={i===0?"eager":"lazy"} fetchPriority={i===0?"high":"low"}/>)}</div>
    <div className="agency-hero-shade"/>
    <div className="agency-hero-copy" key={current}>
      <p className="agency-kicker"><span/> {slide.eyebrow || "مساحة لفكرتك. حضور لعلامتك."}</p>
      <h1>{slide.title}<span>{slide.accent}</span></h1>
      <p className="agency-hero-description">{slide.description}</p>
      <a className="agency-pill agency-pill-lime" href="#quote">ابدأ حكاية علامتك <ArrowLeft size={20}/></a>
    </div>
    <div className="agency-hero-footer">
      <a href="#about" className="agency-scroll"><ArrowDown size={17}/><span>اكتشف الفرق</span></a>
      <div className="agency-slide-navigation">
        <div className="agency-slide-dots" aria-label="اختيار الشريحة">{slides.map((_,i)=><button key={i} aria-label={`الانتقال للشريحة ${i+1}`} aria-pressed={current===i} onClick={()=>go(i)}><span className={current===i?"is-active":""} style={{animationPlayState:running?"running":"paused"}} key={`${current}-${i}`}/></button>)}</div>
        <span dir="ltr" className="agency-slide-count">{String(current+1).padStart(2,"0")} <i>/ {String(slides.length).padStart(2,"0")}</i></span>
        <button className="agency-round" onClick={()=>go(current-1)} aria-label="الشريحة السابقة"><ArrowRight size={19}/></button>
        <button className="agency-round" onClick={()=>go(current+1)} aria-label="الشريحة التالية"><ArrowLeft size={19}/></button>
        <button className="agency-round" onClick={()=>setPaused(p=>!p)} aria-label={paused?"تشغيل السلايدر":"إيقاف السلايدر"}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>
      </div>
    </div>
    {(slide.illustrative ?? slide.image_url.startsWith("/media/agency/")) && <span className="agency-concept-caption">تصور بصري إبداعي</span>}
  </section>;
}
