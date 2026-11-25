"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
const tour = [
  {section:"customers",title:"ابدأ بالجهة المتعاقدة",text:"اضغط «إضافة طرف». اكتب اسم الجهة، مثل جهاز مدينة الشروق، واختر «جهة مالكة». أضف صاحب الامتياز والمورد والمعلن كأطراف منفصلة عند الحاجة.",kind:"party"},
  {section:"geography",title:"عرّف المنطقة والشارع",text:"اختر المحافظة ثم المنطقة ثم الشارع من عنوان موقع الإعلان. أضف الناقص من الأزرار الموجودة تحت كل اختيار؛ يختاره النظام بعد الحفظ دون الانتقال إلى صفحة أخرى. إنشاء العناوين متاح لمسؤول الشركة.",kind:null},
  {section:"assets",title:"عرّف اللوحة وحدد موقعها",text:"اضغط «إضافة لوحة». أدخل كودًا فريدًا ونوع اللوحة ومقاسها، ثم اختر المحافظة والمنطقة والشارع بالتتابع. يمكنك إضافة العنوان الناقص من نفس النموذج. انقر على الخريطة أو اسحب العلامة إلى المكان الصحيح، ثم أضف صورة الموقع.",kind:"asset"},
  {section:"upstream",title:"اربط حق الاستغلال باللوحات",text:"اضغط «عقد استغلال جديد». اختر الجهة، وتاريخ البداية والنهاية، وقيمة العقد، واللوحات المشمولة والتكلفة الشهرية لكل لوحة. يمكن اختيار لوحات من عدة شوارع.",kind:"upstream"},
  {section:"licenses",title:"أضف تصريح اللوحة",text:"اضغط «إضافة ترخيص». اختر اللوحات المشمولة وأدخل رقم التصريح والجهة المصدرة وبداية الصلاحية ونهايتها. النظام يمنع الحجز خارج صلاحية التصاريح بعد تفعيل تحديث قاعدة البيانات.",kind:"license"},
  {section:"inventory",title:"جهّز المخزن والأصناف",text:"من المخازن والمعدات أضف المخزن، ثم صنفًا لكل نوع ومقاس ووحدة قياس. مثال: هيكل لوحة 6×3 متر بوحدة قطعة. لا تسجّل طلب الشراء كرصد موجود قبل الاستلام.",kind:null},
  {section:"purchases",title:"اطلب المعدات واستلمها",text:"أنشئ أمر شراء واختر المورد ومخزن الاستلام والأصناف وكمياتها وتكلفة الوحدة. بعد وصول البضاعة افتح الأمر ونفّذ الاستلام، ثم سجّل فاتورة المورد. التصنيع الداخلي الكامل يحتاج استكمالًا.",kind:null},
  {section:"maintenance",title:"كلّف فريق التركيب",text:"من صفحة التركيب والصيانة أضف أمر تركيب مرتبطة باللوحة، والفني المسؤول وموعد الإنجاز. من المخزن سجّل صرف المعدات واربطها باللوحة وأمر العمل، ثم حدّث حالة التنفيذ.",kind:null},
  {section:"leads",title:"راجع طلب المعلن",text:"راجع الطلب القادم من الموقع، وتحقق من الإتاحة ومكان الإعلان ومقاسه والمدة المطلوبة. سجّل المعلن ضمن العملاء والموردون والجهات قبل إنشاء عقده.",kind:null},
  {section:"contracts",title:"سجّل عقد الإعلان وسعره",text:"اضغط «عقد جديد». اختر المعلن والمدة واللوحات، واكتب السعر الشهري لكل بند. تأكد من أن مدة الحملة داخل حق الاستغلال والتصريح، وخطط لتركيب الخامة وفكها بأوامر عمل.",kind:"contract"},
  {section:"finance",title:"سجّل الفاتورة والتحصيل",text:"اضغط «فاتورة جديدة» وأدخل البنود والضريبة والاستحقاق. سجّل التحصيل على الفاتورة والخزينة الصحيحة؛ توقيع العقد لا يعني تحصيل قيمته.",kind:"invoice"},
  {section:"reports",title:"راقب الإشغال والعائد",text:"راجع الإيرادات وتكلفة حق الاستغلال والإشغال والتغطية الجغرافية. أضف مصروفات التشغيل والإهلاك قبل اعتبار الهامش صافي ربح. انتهت الجولة؛ يمكنك إعادة تشغيلها من دليل الاستخدام.",kind:null},
];
export function GuidedTour({section,demo,canOpen,onOpen}:{section:string;demo:boolean;canOpen:boolean;onOpen:(kind:string)=>void}) {
  const params=useSearchParams();
  const raw=params.get("tour");
  const index=raw!==null&&/^\d+$/.test(raw)?Number(raw):-1;
  const step=tour[index];
  const active=!!step&&step.section===section;
  const base=demo?"/demo":"/app";
  useEffect(()=>{
    if(!active)return;
    const target=document.querySelector<HTMLElement>('[data-tour-create]');
    target?.classList.add('tour-highlight');
    return ()=>target?.classList.remove('tour-highlight');
  },[active,section]);
  if(!active)return null;
  return <aside className="guided-tour" aria-label="الجولة التفاعلية"><div><span className="eyebrow">الجولة التفاعلية · {index+1} / {tour.length}</span><h2>{step.title}</h2><p>{step.text}</p><small>{demo?"أنت في الديمو؛ الحفظ معطّل ويمكنك استكشاف الحقول.":"الجولة لا تحفظ شيئًا تلقائيًا. احفظ من النموذج بنفسك عند اكتمال البيانات؛ «التالي» ينتقل للشرح التالي فقط."}</small></div><div className="tour-controls">
    {step.kind&&canOpen&&<button type="button" className="button primary" onClick={()=>onOpen(step.kind!)}>افتح نموذج هذه الخطوة</button>}
    {step.kind&&!canOpen&&<p>إن لم يظهر زر الإضافة، تحقق من دورك وتفعيل الوحدة مع مدير الشركة.</p>}
    {index>0&&<Link className="button secondary" href={`${base}/${tour[index-1].section}?tour=${index-1}`}>السابق</Link>}
    {index<tour.length-1?<Link className="button primary" href={`${base}/${tour[index+1].section}?tour=${index+1}`}>التالي ←</Link>:<Link className="button primary" href={`${base}/guide`}>إنهاء الجولة</Link>}
    <Link className="button secondary" href={`${base}/${section}`}>إغلاق الجولة</Link>
  </div></aside>;
}
