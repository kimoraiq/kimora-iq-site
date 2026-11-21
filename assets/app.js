
(function(){
"use strict";
const menuButton=document.querySelector(".menu-toggle");
const mobileMenu=document.getElementById("mobile-navigation");
if(menuButton&&mobileMenu){
 menuButton.addEventListener("click",function(){
  const open=menuButton.getAttribute("aria-expanded")==="true";
  menuButton.setAttribute("aria-expanded",String(!open));
  menuButton.setAttribute("aria-label",open?"Open navigation":"Close navigation");
  mobileMenu.hidden=open;
 });
 mobileMenu.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){mobileMenu.hidden=true;menuButton.setAttribute("aria-expanded","false");});});
}
const year=document.getElementById("year");
if(year)year.textContent=String(new Date().getFullYear());
const config=window.KIMORA_SUPABASE||{};
function configured(){return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(config.url||""))&&typeof config.anonKey==="string"&&config.anonKey.length>20;}
const iconByGroup={"water-treatment":"droplet","industrial":"flask","specialty":"settings"};
const iconSvg={
 droplet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3c-2.8 4-7 8-7 12a7 7 0 0 0 14 0c0-4-4.2-8-7-12Z"/></svg>',
 flask:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3h6M10 3v6l-5.7 9a2 2 0 0 0 1.7 3h12a2 2 0 0 0 1.7-3L14 9V3M7 16h10"/></svg>',
 settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>'
};
const filterButtons=document.querySelectorAll("[data-filter]");
const productGrid=document.getElementById("product-grid");
function filterProducts(filter){
 if(!productGrid)return;
 filterButtons.forEach(function(b){const active=b.dataset.filter===filter;b.classList.toggle("is-selected",active);b.setAttribute("aria-pressed",String(active));});
 productGrid.querySelectorAll("[data-product-category]").forEach(function(c){c.hidden=filter!=="all"&&c.dataset.productCategory!==filter;});
}
filterButtons.forEach(function(b){b.addEventListener("click",function(){filterProducts(b.dataset.filter);});});
function filterFromHash(){
 const hash=decodeURIComponent(window.location.hash.slice(1));
 if(["water-treatment","industrial","specialty"].includes(hash))filterProducts(hash);
}
window.addEventListener("hashchange",filterFromHash);filterFromHash();
function el(type,className,text){const e=document.createElement(type);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
if(productGrid&&configured()){
 const loading=document.getElementById("product-loading");
 if(loading)loading.hidden=false;
 fetch(config.url.replace(/\/$/,"")+"/rest/v1/products?select=title,description,category&active=eq.true&order=sort_order.asc,title.asc&limit=100",{
  headers:{"apikey":config.anonKey,"Authorization":"Bearer "+config.anonKey}
 }).then(function(r){if(!r.ok)throw new Error("Catalog unavailable");return r.json();})
 .then(function(items){
  if(!Array.isArray(items)||items.length===0)return;
  const fragment=document.createDocumentFragment();
  items.forEach(function(item){
   if(!item||!["water-treatment","industrial","specialty"].includes(item.category))return;
   const article=el("article","catalog-card");article.dataset.productCategory=item.category;
   const top=el("div","catalog-top");const icon=el("span","catalog-icon");icon.innerHTML=iconSvg[iconByGroup[item.category]];
   const arrow=el("span","catalog-arrow");arrow.innerHTML=iconSvg.arrow;top.append(icon,arrow);article.append(top);
   article.append(el("span","catalog-category",item.category.replace("-"," ").toUpperCase()));
   article.append(el("h3","",String(item.title||"Product").slice(0,140)));
   article.append(el("p","",String(item.description||"Contact us for details.").slice(0,1000)));
   const link=el("a","catalog-link","Request details ");link.href="contact.html#inquiry";link.insertAdjacentHTML("beforeend",iconSvg.arrow);article.append(link);fragment.append(article);
  });
  if(fragment.childNodes.length){productGrid.replaceChildren(fragment);filterProducts(document.querySelector(".filter-button.is-selected")?.dataset.filter||"all");if(window.KIMORA_I18N)window.KIMORA_I18N.refresh();}
 }).catch(function(){/* Keep static overview if the optional live catalog is unavailable. */})
 .finally(function(){if(loading)loading.hidden=true;});
}
const form=document.getElementById("contact-form");
const status=document.getElementById("form-status");
if(form&&status){
 const started=Date.now();
 function show(message,success){status.textContent=window.KIMORA_I18N?window.KIMORA_I18N.getText(message):message;status.className="form-status "+(success?"is-success":"is-error");}
 form.addEventListener("submit",async function(event){
  event.preventDefault();
  status.textContent="";
  if(!form.reportValidity())return;
  const data=new FormData(form);
  if(String(data.get("website")||"").trim())return;
  if(Date.now()-started<2500){show("Please review your message and try again.",false);return;}
  if(!configured()){show("Online inquiries are not yet connected. Please check back soon.",false);return;}
  const payload={
   full_name:String(data.get("full_name")||"").trim(),
   email:String(data.get("email")||"").trim(),
   company:String(data.get("company")||"").trim()||null,
   service:String(data.get("service")||""),
   message:String(data.get("message")||"").trim()
  };
  if(payload.full_name.length<2||payload.message.length<10){show("Please provide your name and a message of at least 10 characters.",false);return;}
  const submit=form.querySelector('button[type="submit"]');
  submit.disabled=true;submit.setAttribute("aria-busy","true");
  try{
   const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/inquiries",{method:"POST",headers:{"apikey":config.anonKey,"Authorization":"Bearer "+config.anonKey,"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(payload)});
   if(!response.ok)throw new Error("Request failed");
   form.reset();show("Thank you. Your message has been submitted successfully.",true);
  }catch(_error){show("Your message could not be sent right now. Please try again later.",false);}
  finally{submit.disabled=false;submit.removeAttribute("aria-busy");}
 });
}
})();
