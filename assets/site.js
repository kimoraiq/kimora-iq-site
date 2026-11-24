/* KIMORA IQ website behavior: inline bilingual UX, contact form & in-page gallery. */
(function(){
"use strict";
const html=document.documentElement;
const $=id=>document.getElementById(id);
const messages={
 ar:{
  required:"يرجى تعبئة الحقول المطلوبة قبل إرسال الاستفسار.",
  invalidName:"يرجى إدخال الاسم الكامل (حرفان على الأقل).",
  invalidEmail:"يرجى إدخال بريد إلكتروني صحيح.",
  invalidService:"يرجى تحديد نوع الاستفسار.",
  invalidMessage:"يرجى كتابة رسالة من 10 أحرف على الأقل.",
  config:"نموذج التواصل غير متاح حاليًا. يمكنك التواصل عبر واتساب أو البريد الإلكتروني.",
  sending:"جارٍ إرسال الاستفسار…",
  success:"تم استلام رسالتك بنجاح. شكرًا لتواصلك مع كيمورا.",
  error:"تعذر إرسال الرسالة الآن. يرجى المحاولة مجددًا أو التواصل معنا مباشرة."
 },
 en:{
  required:"Please complete the required fields.",
  invalidName:"Please enter your full name (at least 2 characters).",
  invalidEmail:"Please enter a valid email address.",
  invalidService:"Please choose an inquiry type.",
  invalidMessage:"Please enter a message of at least 10 characters.",
  config:"The inquiry form is temporarily unavailable. Please reach us via WhatsApp or email.",
  sending:"Sending your inquiry…",
  success:"Your inquiry has been received. Thank you for contacting KIMORA IQ.",
  error:"Your message could not be sent right now. Please try again or contact us directly."
 }
};
let lang="en";
const languageButtons=[...document.querySelectorAll("[data-lang]")];
function setLanguage(next){
 lang=next==="ar"?"ar":"en";
 html.lang=lang;html.dir=lang==="ar"?"rtl":"ltr";
 document.querySelectorAll("[data-en][data-ar]").forEach(node=>{node.textContent=node.getAttribute("data-"+lang)||""});
 document.querySelectorAll("[data-placeholder-en][data-placeholder-ar]").forEach(node=>{node.placeholder=node.getAttribute("data-placeholder-"+lang)||""});
 languageButtons.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lang===lang)));
 document.title=html.dataset[lang==="ar"?"titleAr":"titleEn"]||document.title;
 try{localStorage.setItem("kimora-language",lang)}catch(_){}
}
languageButtons.forEach(b=>b.addEventListener("click",()=>setLanguage(b.dataset.lang)));
let initial="en";
try{initial=localStorage.getItem("kimora-language")||"en"}catch(_){}
const urlLang=new URLSearchParams(location.search).get("lang");
if(urlLang==="en"||urlLang==="ar")initial=urlLang;
setLanguage(initial);
document.querySelectorAll("[data-year]").forEach(n=>n.textContent=String(new Date().getFullYear()));
const menu=$("menu-toggle"),mobile=$("mobile-nav");
function closeMenu(){if(menu&&mobile){menu.setAttribute("aria-expanded","false");mobile.hidden=true;}}
if(menu&&mobile){
 menu.addEventListener("click",()=>{const open=menu.getAttribute("aria-expanded")==="true";menu.setAttribute("aria-expanded",String(!open));mobile.hidden=open});
 mobile.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});
 document.addEventListener("click",e=>{if(!mobile.hidden&&!mobile.contains(e.target)&&!menu.contains(e.target))closeMenu()});
}
// Contact messages are stored in Supabase: public insert only, RLS keeps messages private.
const form=$("contact-form"),status=$("form-status");
if(form&&status){
 const config=window.KIMORA_SUPABASE||{};
 const validConfig=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(config.url||""))&&typeof config.anonKey==="string"&&config.anonKey.startsWith("sb_publishable_");
 const show=(text,isError)=>{status.hidden=false;status.textContent=text;status.classList.toggle("is-error",Boolean(isError));status.scrollIntoView({behavior:"smooth",block:"nearest"})};
 const submit=$("contact-submit");
 form.addEventListener("submit",async e=>{
  e.preventDefault();
  const data=new FormData(form);
  if(String(data.get("website")||"").trim())return;
  const fields={
    full_name:String(data.get("full_name")||"").trim(),
    email:String(data.get("email")||"").trim(),
    company:String(data.get("company")||"").trim()||null,
    service:String(data.get("service")||""),
    message:String(data.get("message")||"").trim()
  };
  let error="";
  if(fields.full_name.length<2||fields.full_name.length>120)error="invalidName";
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)||fields.email.length>254)error="invalidEmail";
  else if(!["water-treatment","industrial-chemicals","product-information","other"].includes(fields.service))error="invalidService";
  else if(fields.message.length<10||fields.message.length>4000)error="invalidMessage";
  if(error){show(messages[lang][error],true);return}
  if(!validConfig){show(messages[lang].config,true);return}
  submit.disabled=true;submit.setAttribute("aria-busy","true");show(messages[lang].sending,false);
  try{
   const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/inquiries",{
    method:"POST",headers:{"apikey":config.anonKey,"Content-Type":"application/json","Prefer":"return=minimal"},
    body:JSON.stringify(fields)
   });
   if(!response.ok)throw new Error("Supabase insert failed");
   form.reset();show(messages[lang].success,false);
  }catch(_){show(messages[lang].error,true)}
  finally{submit.disabled=false;submit.removeAttribute("aria-busy")}
 });
}
// Branded product viewer is part of the page, never a new browser tab.
const grid=$("gallery-grid"),viewer=$("product-viewer");
if(grid&&viewer){
 const buttons=[...grid.querySelectorAll("[data-gallery-index]")];
 const image=$("viewer-image"),count=$("viewer-count"),close=$("viewer-close");
 let index=0,previousFocus=null;
 const showIndex=n=>{
  index=(n+buttons.length)%buttons.length;
  image.src="/"+(index+1)+".webp";
  image.alt="KIMORA IQ product "+(index+1);
  count.textContent=String(index+1).padStart(2,"0")+" / "+buttons.length;
 };
 const closeViewer=()=>{
  if(viewer.hidden)return;
  viewer.hidden=true;
  document.body.classList.remove("viewer-open");
  if(previousFocus&&typeof previousFocus.focus==="function")previousFocus.focus();
 };
 const openViewer=n=>{
  previousFocus=document.activeElement;
  showIndex(n);
  viewer.hidden=false;
  document.body.classList.add("viewer-open");
  close.focus();
 };
 buttons.forEach(btn=>btn.addEventListener("click",()=>openViewer(Number(btn.dataset.galleryIndex))));
 close.addEventListener("click",closeViewer);
 $("viewer-prev").addEventListener("click",()=>showIndex(index-1));
 $("viewer-next").addEventListener("click",()=>showIndex(index+1));
 viewer.addEventListener("click",e=>{if(e.target===viewer)closeViewer()});
 document.addEventListener("keydown",e=>{
  if(viewer.hidden)return;
  if(e.key==="Escape"){e.preventDefault();closeViewer()}
  if(e.key==="ArrowLeft"){e.preventDefault();showIndex(index-1)}
  if(e.key==="ArrowRight"){e.preventDefault();showIndex(index+1)}
  if(e.key==="Tab"){
   const focusable=[close,$("viewer-prev"),$("viewer-next")];
   const pos=focusable.indexOf(document.activeElement);
   if(e.shiftKey&&pos===0){e.preventDefault();focusable[focusable.length-1].focus()}
   else if(!e.shiftKey&&pos===focusable.length-1){e.preventDefault();focusable[0].focus()}
  }
 });
}
})();
