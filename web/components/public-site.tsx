import Link from "next/link";
import {
  PanelsTopLeft,
  ArrowUpLeft,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import type { Brand } from "@/lib/types";
import type { CSSProperties } from "react";
import {EnquiryForm} from './enquiry-form';
export type CatalogItem = {
  code: string;
  street: string;
  category: string;
  length_m: number | null;
  width_m: number | null;
  faces: number;
};
export function PublicSite({
  brand: b,
  catalog,
  demo = false,
}: {
  brand: Brand;
  catalog: CatalogItem[];
  demo?: boolean;
}) {
  const phone = b.contact_phone?.replace(/[^+\d]/g, "");
  const wa = b.whatsapp?.replace(/\D/g, "");
  const email =
    b.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contact_email)
      ? b.contact_email
      : null;
  return (
    <div
      className="public-page"
      style={{ "--brand": b.primary_color } as CSSProperties}
    >
      {demo && (
        <div className="public-demo">
          معاينة لموقع عميل · الهوية والمواقع وبيانات الاتصال تجريبية{" "}
          <Link href="/demo/dashboard">— العودة للوحة الإدارة</Link>
        </div>
      )}
      <nav className="public-nav">
        <Link href={demo ? "/demo-site" : "/"} className="public-logo">
          {b.logo_url ? (
            <img src={b.logo_url} alt={b.name} />
          ) : (
            <PanelsTopLeft size={30} />
          )}
          <span>{b.name}</span>
        </Link>
        <div className="public-nav-links">
          <a href="#locations">مواقعنا الإعلانية</a>
          <a href="#contact">تواصل معنا</a>
          <Link
            href={demo ? "/demo/dashboard" : "/login"}
            className="button secondary"
          >
            دخول فريق العمل <ArrowUpLeft size={16} />
          </Link>
        </div>
      </nav>
      <section className="public-hero">
        <div>
          <span className="public-eyebrow">مساحات إعلانية · حضور أكبر</span>
          <h1>{b.website_title || "مساحة يراها الجميع."}</h1>
          <p>
            {b.website_description ||
              "اكتشف المواقع الإعلانية المتاحة وتواصل معنا لاختيار المساحة المناسبة لحملتك القادمة."}
          </p>
          <div className="hero-buttons">
            <a href="#locations" className="button primary">
              اكتشف المواقع <ArrowUpLeft size={17} />
            </a>
            <a href="#contact" className="button secondary">
              تواصل مع فريقنا
            </a>
          </div>
        </div>
        <div className="hero-visual" aria-label="تصميم تمثيلي لمساحة إعلانية">
          <div className="city-lines" />
          <MapPin className="visual-pin" size={48} />
          <div className="billboard">
            <b>{b.name}</b>
            <span>YOUR NEXT BIG MOVE</span>
            <small>مساحتك. رسالتك. جمهورك.</small>
          </div>
          <div className="visual-chip">
            <ShieldCheck size={30} />
            <span>
              <b>مواقع مختارة. إدارة متكاملة.</b>نساعد علامتك على الوصول
            </span>
          </div>
        </div>
      </section>
      <section id="locations" className="public-section">
        <span className="public-eyebrow">على الطريق إلى جمهورك</span>
        <h2>مواقعنا الإعلانية</h2>
        <p>
          مجموعة من مواقع الشركة المنشورة. تواصل معنا للتحقق من التوفر والأسعار.
        </p>
        <div className="catalog-grid">
          {catalog.map((a) => (
            <article className="catalog-item" key={a.code}>
              <PanelsTopLeft size={32} />
              <h3>{a.street}</h3>
              <p>
                {a.category} · {a.code}
              </p>
              <span>
                {a.length_m || "—"} × {a.width_m || "—"} م · {a.faces} أوجه
              </span>
            </article>
          ))}
        </div>
        {!catalog.length && (
          <div className="notice">
            نجهّز دليل مواقعنا. تواصل مع الفريق لمعرفة المواقع المتاحة لحملتك.
          </div>
        )}
      </section>
      <section id="contact" className="public-section">
        <div className="contact-section">
          <div>
            <h2>لنصنع حضورك القادم.</h2>
            <p>{b.address || "تواصل معنا لاختيار موقع حملتك."}</p>
          </div>
          <div className="contact-links">
            {phone && (
              <a href={`tel:${phone}`}>
                <Phone size={17} />
                <span dir="ltr">{b.contact_phone}</span>
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`}>
                <Mail size={17} />
                <span dir="ltr">{email}</span>
              </a>
            )}
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                تحدث معنا عبر واتساب <ArrowUpRight size={17} />
              </a>
            )}
            {!phone && !email && !wa && (
              <span>ستتوفر بيانات التواصل قريبًا.</span>
            )}
          </div>
        </div>
      </section>
    <section className="public-section"><EnquiryForm demo={demo}/></section>
    <footer className="public-footer">
        <span>
          © {new Date().getFullYear()} {b.name}. جميع الحقوق محفوظة.
        </span>
        <span>بدعم من Mesk LLC</span>
      </footer>
    </div>
  );
}
