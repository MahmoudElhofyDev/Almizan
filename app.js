
const app=document.getElementById("app");
const tokenKey="mizan_token";
const token=()=>localStorage.getItem(tokenKey);
const authHeaders=(extra={})=>({...extra,Authorization:`Bearer ${token()}`});

async function api(url,options={}){
  const headers=options.body instanceof FormData?authHeaders(options.headers||{}):authHeaders({"Content-Type":"application/json",...(options.headers||{})});
  const r=await fetch("/api"+url,{...options,headers});
  let d={}; try{d=await r.json()}catch{}
  if(!r.ok) throw new Error(d.message||"حدث خطأ");
  return d;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]))}
function login(){
  app.innerHTML=`<main class="screen"><section class="card login"><h1>مــيــزان</h1><p>إدارة مكتب المحاماة</p><form id="f"><input id="u" value="admin" placeholder="اسم المستخدم"><input id="p" type="password" value="admin123" placeholder="كلمة المرور"><button>تسجيل الدخول</button><div id="e" class="error"></div></form></section></main>`;
  f.onsubmit=async e=>{e.preventDefault();try{const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u.value,password:p.value})});const d=await r.json();if(!r.ok)throw Error(d.message);localStorage.setItem(tokenKey,d.token);home()}catch(x){document.getElementById("e").textContent=x.message}};
}
function shell(title){
  app.innerHTML=`<main class="screen"><section class="container"><header><div><h1>مــيــزان</h1><p>${title}</p></div><div><button id="home">↩ الرئيسية</button><button id="out" class="danger">خروج</button></div></header><section id="body" class="card"></section></section></main>`;
  home.onclick=home;out.onclick=()=>{localStorage.removeItem(tokenKey);login()};
}
function home(){
  if(!token())return login();
  shell("لوحة التحكم");
  body.innerHTML=`<div class="grid"><button class="tile" id="searchPage">🔎 البحث العام</button><button class="tile" id="casesPage">📁 ملفات الحفظ</button><button class="tile" id="powersPage">📜 ملفات التوكيلات</button></div><div id="stats" class="notice"></div>`;
  searchPage.onclick=searchView;casesPage.onclick=casesView;powersPage.onclick=powersView;
  api("/dashboard").then(d=>stats.textContent=`ملفات الحفظ: ${d.cases} — التوكيلات: ${d.powers}`);
}
function table(headers,rows){
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function searchView(){
  shell("البحث العام");
  body.innerHTML=`<div class="toolbar"><input id="q" placeholder="اكتب اسم الموكل أو رقم الملف أو رقم التوكيل"><button id="go">بحث</button></div><div class="notice">لا توجد بيانات معروضة قبل البحث.</div><div id="results"></div>`;
  go.onclick=async()=>{const qv=q.value.trim();if(!qv){results.innerHTML='<div class="notice">اكتب كلمة للبحث.</div>';return}try{const d=await api("/search?q="+encodeURIComponent(qv));results.innerHTML=`<h3>ملفات الحفظ (${d.cases.length})</h3>`+(d.cases.length?table(["رقم الملف","اسم الموكل"],d.cases.map(r=>`<tr><td>${esc(r.file_number)}</td><td>${esc(r.client_name)}</td></tr>`).join("")):'<div class="notice">لا توجد نتائج.</div>')+`<h3>التوكيلات (${d.powers.length})</h3>`+(d.powers.length?table(["رقم الملف","اسم الموكل","رقم التوكيل","جهة التوثيق"],d.powers.map(r=>`<tr><td>${esc(r.file_number)}</td><td>${esc(r.client_name)}</td><td>${esc(r.power_number)}</td><td>${esc(r.documentation_authority)}</td></tr>`).join("")):'<div class="notice">لا توجد نتائج.</div>')}catch(e){results.innerHTML='<div class="error">'+esc(e.message)+'</div>'}};
}
function modal(title,fields,save){
  const x=document.createElement("div");x.className="modal";x.innerHTML=`<div class="card"><h3>${title}</h3>${fields.map(f=>`<input id="m_${f.id}" placeholder="${f.label}" value="${esc(f.value||"")}">`).join("")}<button id="ms">حفظ</button><button id="mc">إلغاء</button><div id="me" class="error"></div></div>`;document.body.appendChild(x);mc.onclick=()=>x.remove();ms.onclick=async()=>{try{const v={};fields.forEach(f=>v[f.id]=document.getElementById("m_"+f.id).value.trim());await save(v);x.remove()}catch(e){me.textContent=e.message}};
}
async function genericView(type){
  shell(type==="cases"?"ملفات الحفظ":"ملفات التوكيلات");
  const power=type==="powers";
  body.innerHTML=`<div class="toolbar"><input id="q" placeholder="ابحث..."><button id="go">بحث</button><button id="inc">البيانات الناقصة</button><button id="add">+ إضافة</button><button id="imp">استيراد Excel</button><input id="file" type="file" hidden accept=".xlsx,.xls,.csv"></div><div id="tableArea"><div class="notice">البيانات مخفية حتى البحث.</div></div>`;
  let mode="search";
  async function load(){if(mode==="search"&&!q.value.trim()){tableArea.innerHTML='<div class="notice">البيانات مخفية حتى البحث.</div>';return}const d=await api(`/${type}?q=${encodeURIComponent(mode==="search"?q.value:"")}&incomplete=${mode==="inc"?1:0}&page=1&limit=100`);if(!d.data.length){tableArea.innerHTML='<div class="notice">لا توجد نتائج.</div>';return}const heads=power?["رقم الملف","اسم الموكل","رقم التوكيل","جهة التوثيق",""]:["رقم الملف","اسم الموكل",""];tableArea.innerHTML=table(heads,d.data.map(r=>`<tr><td>${esc(r.file_number)}</td><td>${esc(r.client_name)}</td>${power?`<td>${esc(r.power_number)}</td><td>${esc(r.documentation_authority)}</td>`:""}<td><button class="edit" data-id="${r.id}">تعديل</button> <button class="del danger" data-id="${r.id}">حذف</button></td></tr>`).join(""));tableArea.querySelectorAll(".edit").forEach(b=>b.onclick=()=>{const r=d.data.find(x=>x.id==b.dataset.id);const fields=power?[{id:"file_number",label:"رقم الملف",value:r.file_number},{id:"client_name",label:"اسم الموكل",value:r.client_name},{id:"power_number",label:"رقم التوكيل",value:r.power_number},{id:"documentation_authority",label:"جهة التوثيق",value:r.documentation_authority}]:[{id:"file_number",label:"رقم الملف",value:r.file_number},{id:"client_name",label:"اسم الموكل",value:r.client_name}];modal("تعديل",fields,async v=>{await api(`/${type}/${r.id}`,{method:"PUT",body:JSON.stringify(v)});load()})});tableArea.querySelectorAll(".del").forEach(b=>b.onclick=async()=>{if(confirm("حذف السجل؟")){await api(`/${type}/${b.dataset.id}`,{method:"DELETE"});load()}})}
  go.onclick=()=>{mode="search";load()};inc.onclick=()=>{mode="inc";load()};add.onclick=async()=>{const last=await api(power?"/powers/last-file":"/cases/last-file");const fields=power?[{id:"file_number",label:"رقم الملف",value:last.next},{id:"client_name",label:"اسم الموكل"},{id:"power_number",label:"رقم التوكيل"},{id:"documentation_authority",label:"جهة التوثيق"}]:[{id:"file_number",label:"رقم الملف",value:last.next},{id:"client_name",label:"اسم الموكل"}];modal("إضافة",fields,async v=>{await api("/"+type,{method:"POST",body:JSON.stringify(v)});mode="search";q.value=v.client_name;load()})};imp.onclick=()=>file.click();file.onchange=async()=>{if(!file.files[0])return;const fd=new FormData();fd.append("file",file.files[0]);try{const d=await api(`/import/${type}`,{method:"POST",body:fd});alert(`تم الحفظ\\nالإضافة: ${d.inserted}\\nالمكرر: ${d.duplicate}\\nالناقص: ${d.incomplete}`);mode="search";q.value="";tableArea.innerHTML='<div class="notice">تم الاستيراد. ابحث لعرض البيانات.</div>'}catch(e){alert(e.message)}file.value=""};
}
function casesView(){genericView("cases")} function powersView(){genericView("powers")}
if(token())home();else login();
