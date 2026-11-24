/* KIMORA IQ admin inbox — all permissions are enforced by Supabase RLS. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const config=window.KIMORA_SUPABASE||{};
const storageKey="kimora-iq-admin-session";
const serviceNames={"water-treatment":"معالجة المياه","industrial-chemicals":"المواد الصناعية","product-information":"معلومات المنتجات","other":"استفسار عام"};
const statusNames={"new":"جديدة","in_progress":"قيد المتابعة","resolved":"مكتملة"};
let session=null,items=[],selectedId=null,loading=false;
const setText=(id,value)=>{const e=$(id);if(e)e.textContent=String(value??"")};
const isConfigured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(config.url||""))&&typeof config.anonKey==="string"&&config.anonKey.startsWith("sb_publishable_");
const datetime=value=>{if(!value)return "—";try{return new Intl.DateTimeFormat("ar-IQ",{timeZone:"Asia/Baghdad",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value))}catch(_){return value}};
const msg=(text,isSuccess=false,el="dashboardMessage")=>{const e=$(el);if(!e)return;e.textContent=text||"";e.classList.toggle("is-success",!!isSuccess)};
function store(){try{if(session)sessionStorage.setItem(storageKey,JSON.stringify(session));else sessionStorage.removeItem(storageKey)}catch(_){}}
function restore(){try{const s=JSON.parse(sessionStorage.getItem(storageKey)||"null");if(s&&typeof s.access_token==="string"&&typeof s.refresh_token==="string")session=s}catch(_){}}
async function request(path,opts={},retried=false){
 if(!isConfigured)throw Error("لم يكتمل إعداد الاتصال بقاعدة البيانات.");
 const method=opts.method||"GET";
 const h={"apikey":config.anonKey,"Accept":"application/json"};
 if(opts.body!==undefined)h["Content-Type"]="application/json";
 if(opts.auth&&session?.access_token)h.Authorization="Bearer "+session.access_token;
 const res=await fetch(config.url+path,{method,headers:h,body:opts.body===undefined?undefined:JSON.stringify(opts.body),cache:"no-store"});
 if(res.status===401&&opts.auth&&!retried&&session?.refresh_token){
   try{await refreshSession();return request(path,opts,true)}catch(_){session=null;store();throw Error("انتهت الجلسة. سجّل الدخول مرة ثانية.")}
 }
 const ct=res.headers.get("content-type")||"";
 const payload=ct.includes("json")?await res.json().catch(()=>null):await res.text().catch(()=>"");
 if(!res.ok)throw Error((payload&&typeof payload==="object"&&(payload.msg||payload.message||payload.error_description))||"تعذر تنفيذ العملية. تحقق من الاتصال والصلاحيات.");
 return payload;
}
async function refreshSession(){
 const result=await request("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:session.refresh_token}});
 if(!result?.access_token||!result?.refresh_token)throw Error("تعذر تجديد الجلسة");
 session=result;store();
}
function showLogin(error){
 $("dashboardPane").hidden=true;$("loginPane").hidden=false;$("signOut").hidden=true;
 if(error)msg(error,false,"loginMessage");
}
function showDashboard(){
 $("loginPane").hidden=true;$("dashboardPane").hidden=false;$("signOut").hidden=false;msg("","","loginMessage");
}
async function verifyAdmin(){
 if(!session?.access_token)throw Error("يجب تسجيل الدخول أولًا.");
 const rows=await request("/rest/v1/admin_members?select=user_id&limit=1",{auth:true});
 if(!Array.isArray(rows)||rows.length!==1)throw Error("هذا الحساب غير معتمد كأدمن. أضف المستخدم إلى admin_members من Supabase.");
 showDashboard();await loadMessages();
}
async function loadMessages(){
 if(loading)return;
 loading=true;$("refreshButton").disabled=true;msg("جاري تحديث الرسائل…");
 try{
  const data=await request("/rest/v1/inquiries?select=id,full_name,email,company,service,message,status,created_at&order=created_at.desc&limit=500",{auth:true});
  if(!Array.isArray(data))throw Error("استجابة غير متوقعة من قاعدة البيانات.");
  items=data;renderStats();renderList();showDetail();setText("lastUpdated","آخر تحديث: "+datetime(new Date().toISOString()));msg("");
 }catch(error){msg(error.message||"تعذر تحميل الرسائل.")}
 finally{loading=false;$("refreshButton").disabled=false}
}
function renderStats(){
 setText("countAll",items.length);
 setText("countNew",items.filter(i=>i.status==="new").length);
 setText("countProgress",items.filter(i=>i.status==="in_progress").length);
 setText("countResolved",items.filter(i=>i.status==="resolved").length);
}
function renderList(){
 const list=$("messageList");list.replaceChildren();
 const q=$("searchInput").value.trim().toLocaleLowerCase();
 const filter=$("statusFilter").value;
 const filtered=items.filter(i=>(filter==="all"||i.status===filter)&&(!q||[i.full_name,i.email,i.company,i.message].some(x=>String(x||"").toLocaleLowerCase().includes(q))));
 if(filtered.length===0){const e=document.createElement("p");e.className="admin-list-empty";e.textContent=items.length?"ماكو رسائل مطابقة للبحث أو الفلتر.":"ما وصلت رسائل لحد الآن. الرسائل الجديدة راح تظهر هنا.";list.append(e);return}
 const fragment=document.createDocumentFragment();
 filtered.forEach(item=>{
  const button=document.createElement("button");button.type="button";button.className="admin-message-item";button.setAttribute("role","listitem");button.classList.toggle("is-active",item.id===selectedId);
  const top=document.createElement("div");top.className="admin-message-top";
  const name=document.createElement("strong");name.textContent=item.full_name||"—";
  const badge=document.createElement("span");badge.className="admin-status admin-status-"+item.status;badge.textContent=statusNames[item.status]||"—";
  top.append(name,badge);
  const snippet=document.createElement("p");snippet.textContent=item.message||"";
  const bottom=document.createElement("div");bottom.className="admin-message-bottom";
  const email=document.createElement("span");email.textContent=item.email||"";email.dir="ltr";
  const when=document.createElement("span");when.textContent=datetime(item.created_at);bottom.append(email,when);
  button.append(top,snippet,bottom);
  button.addEventListener("click",()=>{selectedId=item.id;renderList();showDetail()});
  fragment.append(button);
 });
 list.append(fragment);
}
function showDetail(){
 const item=items.find(x=>x.id===selectedId);
 $("detailEmpty").hidden=!!item;$("detailContent").hidden=!item;
 if(!item)return;
 setText("detailStatus",statusNames[item.status]||"—");
 $("detailStatus").className="admin-status admin-status-"+item.status;
 setText("detailTime",datetime(item.created_at));
 setText("detailName",item.full_name);
 setText("detailEmail",item.email);
 $("detailEmail").href="mailto:"+encodeURIComponent(String(item.email||""));
 setText("detailCompany",item.company||"غير مذكورة");
 setText("detailService",serviceNames[item.service]||item.service||"—");
 setText("detailMessage",item.message);
 $("replyEmail").href="mailto:"+encodeURIComponent(String(item.email||""))+"?subject="+encodeURIComponent("Kimora IQ - رد على استفسارك");
 $("statusSelect").value=item.status||"new";
}
async function saveStatus(){
 const item=items.find(x=>x.id===selectedId);if(!item)return;
 const status=$("statusSelect").value;if(!Object.keys(statusNames).includes(status))return;
 $("saveStatus").disabled=true;msg("جاري حفظ الحالة…");
 try{
  await request("/rest/v1/inquiries?id=eq."+encodeURIComponent(item.id),{auth:true,method:"PATCH",body:{status}});
  item.status=status;renderStats();renderList();showDetail();msg("تم حفظ حالة الرسالة.",true);
 }catch(error){msg(error.message||"تعذر حفظ الحالة.")}
 finally{$("saveStatus").disabled=false}
}
async function login(event){
 event.preventDefault();msg("","","loginMessage");
 const email=$("adminEmail").value.trim(),password=$("adminPassword").value;
 if(!email||!password)return;
 $("loginButton").disabled=true;
 try{
  const result=await request("/auth/v1/token?grant_type=password",{method:"POST",body:{email,password}});
  if(!result?.access_token||!result?.refresh_token)throw Error("تعذر تسجيل الدخول.");
  session=result;store();$("adminPassword").value="";
  await verifyAdmin();
 }catch(error){session=null;store();showLogin(error.message==="Invalid login credentials"?"البريد الإلكتروني أو كلمة المرور غير صحيحة.":error.message)}
 finally{$("loginButton").disabled=false}
}
async function logout(){
 const access=session?.access_token;
 session=null;store();items=[];selectedId=null;showLogin();msg("");
 if(access){try{await fetch(config.url+"/auth/v1/logout",{method:"POST",headers:{"apikey":config.anonKey,"Authorization":"Bearer "+access}})}catch(_){}}
}
document.addEventListener("DOMContentLoaded",async()=>{
 $("loginForm").addEventListener("submit",login);
 $("signOut").addEventListener("click",logout);
 $("refreshButton").addEventListener("click",loadMessages);
 $("searchInput").addEventListener("input",renderList);
 $("statusFilter").addEventListener("change",renderList);
 $("saveStatus").addEventListener("click",saveStatus);
 if(!isConfigured){showLogin("إعداد Supabase غير متوفر. راجع تكوين المشروع.");return}
 restore();
 if(session){try{await verifyAdmin()}catch(error){session=null;store();showLogin(error.message)}}
});
})();