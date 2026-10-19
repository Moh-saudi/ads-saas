"use client";
import { paymentMethods } from '@/lib/payment-methods.mjs';
export function PaymentMethodField({onChange}:{onChange?:(value:string)=>void}={}){return <label>طريقة التحصيل / الدفع<select name="payment_method" onChange={e=>onChange?.(e.target.value)} required defaultValue=""><option value="" disabled>اختر طريقة العملية</option>{paymentMethods.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select><small>اختر طريقة وصول المبلغ، ثم الخزينة أو الحساب الذي استلمه. اختيار الطريقة لا ينفّذ دفعًا إلكترونيًا.</small></label>;}
