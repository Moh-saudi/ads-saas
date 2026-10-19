"use client";
import Link from 'next/link';
import { useState } from 'react';
import type { WorkspaceData } from '@/lib/types';
import { cairoDay, licenseCovers } from '@/lib/license-periods.mjs';
export function CompanySetup({data:d}:{data:WorkspaceData}) {
 const today=cairoDay(),activeAssets=d.assets.filter(a=>a.live_status!=='retired');
 const steps=[
  {title:'بيانات الشركة',screen:'settings',done:!!(d.brand.name&&d.brand.contact_phone&&d.brand.address),help:'سجّل الاسم وبيانات الاتصال والعنوان وارفع الشعار الذي يظهر في المستندات.'},
  {title:'الموظفون والصلاحيات',screen:'employees',done:d.operations.employeeDirectory.some(e=>e.status==='active')&&d.operations.tenantUsers.some(u=>u.role!=='admin'),help:'أضف الموظفين واربط حساب كل مستخدم بالدور والمنطقة المناسبة من إعدادات الموظفين والصلاحيات.'},
  {title:'الجهات والموردون والعملاء',screen:'customers',done:['authority','supplier','advertiser'].every(type=>d.parties.some(p=>p.type===type)),help:'عرّف الجهة المالكة أو صاحب الامتياز والمورد والمعلن كل طرف بنوعه الصحيح.'},
  {title:'المناطق واللوحات على الخريطة',screen:'assets',done:activeAssets.length>0&&activeAssets.every(a=>a.latitude!=null&&a.longitude!=null),help:'اختر المحافظة والمنطقة والشارع، ثم أضف نقطة كل لوحة ومقاسها وصورتها.'},
  {title:'حق الاستغلال',screen:'upstream',done:activeAssets.length>0&&activeAssets.every(a=>d.operations.upstreamCoverage.some(c=>c.asset_id===a.id&&c.valid_from<=today&&c.valid_to>=today&&d.upstream.some(u=>u.id===c.upstream_contract_id&&u.status==='active'&&u.start_date<=today&&u.end_date>=today))),help:'اربط اللوحات بعقد الجهة المالكة وحدّد مدته وتكلفة كل لوحة. راجع المستند قبل إدخال البيانات.'},
  {title:'التصاريح',screen:'licenses',done:activeAssets.length>0&&activeAssets.every(a=>licenseCovers(d.licenses,a.id,today,today)),help:'سجل بداية ونهاية التصريح واللوحات المشمولة. غطّ مدة الحملة كاملة قبل توقيع عقد المعلن.'},
  {title:'المخازن والتجهيز',screen:'inventory',done:d.operations.warehouses.length>0&&d.operations.items.length>0&&d.operations.stockMoves.length>0,help:'عرّف المخزن والأصناف بالمقاس والخامة، ثم استلم التوريد وسجّل الصرف على اللوحة وأمر العمل.'},
  {title:'الأسعار',screen:'contracts',done:d.operations.pricingRules.some(r=>r.valid_from<=today&&r.valid_to>=today),help:'أضف سعرًا استرشاديًا حسب المنطقة والنوع. السعر النهائي لكل لوحة يُثبت في العقد.'},
  {title:'الخزائن والتحصيل',screen:'cashbook',done:d.operations.cashAccounts.length>0,help:'عرّف الخزائن والبنوك والمحافظ وأرصدتها الصحيحة قبل تسجيل التحصيل والصرف.'},
 ];
 const [index,setIndex]=useState(Math.max(0,steps.findIndex(s=>!s.done)));
 if(d.profile.role!=='admin')return null;
 const step=steps[index],completed=steps.filter(s=>s.done).length,base=d.demo?'/demo':'/app';
 return <section className="card padded company-setup" aria-label="تهيئة الشركة"><div className="card-head"><h2>ابدأ تشغيل شركتك خطوة بخطوة</h2><span>{completed} / {steps.length} مكتمل</span></div><progress value={completed} max={steps.length} aria-label="اكتمال تهيئة الشركة"/><p>الاكتمال محسوب من السجلات الظاهرة لحسابك؛ الانتقال إلى «التالي» لا يسجل أو يحفظ بيانات.</p>
 <div className="setup-steps">{steps.map((s,i)=><button type="button" className={`button ${i===index?'primary':'secondary'}`} key={s.title} onClick={()=>setIndex(i)} aria-current={index===i?'step':undefined}>{s.done?'✓':'○'} {i+1}. {s.title}</button>)}</div>
 <h3>{index+1}. {step.title} — {step.done?'مكتمل':'يحتاج استكمالًا'}</h3><p>{step.help}</p><div className="inline-actions"><Link className="button primary" href={`${base}/${step.screen}`}>افتح الشاشة وأكمل البيانات</Link><button className="button secondary" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>السابق</button><button className="button secondary" disabled={index===steps.length-1} onClick={()=>setIndex(i=>i+1)}>التالي</button></div>
 {d.demo&&<div className="notice">هذه حالة بيانات الديمو فقط؛ لن تنتقل إلى بيانات شركتك.</div>}
 </section>;
}
