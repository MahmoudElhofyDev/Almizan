const app = document.getElementById("app");
const tokenKey = "mizan_token";

function token(){ return localStorage.getItem(tokenKey) || ""; }
function esc(v){
  return String(v ?? "").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));
}

async function api(url, options={}){
  const headers = {...(options.headers||{})};
  if (options.body instanceof FormData) headers.Authorization = `Bearer ${token()}`;
  else {
    headers["Content-Type"] = "application/json";
    headers.Authorization = `Bearer ${token()}`;
  }
  const r = await fetch("/api"+url,{...options,headers});
  const text = await r.text();
  let data={};
  try{ data=text ? JSON.parse(text) : {}; }catch{
    throw new Error("السيرفر لم يرجع JSON. تأكد أن البرنامج يعمل من خلال Backend وليس GitHub Pages.");
  }
  if(!r.ok){
    if(r.status===401){ localStorage.removeItem(tokenKey); loginView(); }
    throw new Error(data.message || "حدث خطأ");
  }
  return data;
}

function loginView(){
  app.innerHTML=`<div class="screen"><div class="login card">
    <div class="logo">مــيــزان</div>
    <p class="sub">إدارة مكتب المحاماة</p>
    <form id="loginForm">
      <label>اسم المستخدم</label><input id="username" value="admin" required>
      <label>كلمة المرور</label><input id="password" type="password" value="admin123" required>
      <button class="btn full">تسجيل الدخول</button>
      <div id="loginError" class="error"></div>
    </form>
  </div></div>`;
  document.getElementById("loginForm").onsubmit=async e=>{
    e.preventDefault();
    const er=document.getElementById("loginError"); er.textContent="";
    try{
      const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({username:username.value,password:password.value})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.message||"فشل الدخول");
      localStorage.setItem(tokenKey,d.token);
      route();
    }catch(err){er.textContent=err.message;}
  };
}

function shell(title,sub){
  return `<div class="screen"><div class="container">
    <div class="header">
      <div><div class="logo">مــيــزان</div><div class="sub">${esc(sub)}</div></div>
      <div class="header-actions"><button class="btn secondary" id="home">↩ العودة للرئيسية</button>
      <button class="btn danger" id="logout">تسجيل الخروج</button></div>
    </div>
    <div class="card page-card"><h2>${esc(title)}</h2><div id="content"></div></div>
  </div></div>`;
}

function bindCommon(){
  document.getElementById("home").onclick=()=>location.hash="";
  document.getElementById("logout").onclick=()=>{localStorage.removeItem(tokenKey);location.hash="";loginView();};
}

async function dashboard(){
  if(!token()) return loginView();
  app.innerHTML=`<div class="screen"><div class="container">
    <div class="header"><div><div class="logo">مــيــزان</div><div class="sub">لوحة التحكم الرئيسية</div></div>
    <button class="btn danger" id="logout">تسجيل الخروج</button></div>
    <div class="grid three" id="stats"></div>
    <div class="grid" style="margin-top:18px">
      <div class="dashboard-card card"><h2>🔎 البحث العام</h2><p class="small">ابحث عن الموكل لتظهر ملفات الحفظ والتوكيلات الخاصة به.</p><button class="btn" id="searchPage">فتح البحث العام</button></div>
      <div class="dashboard-card card"><h2>📁 ملفات الحفظ</h2><p class="small">رقم الملف + اسم الموكل فقط.</p><button class="btn" id="casesPage">فتح ملفات الحفظ</button></div>
      <div class="dashboard-card card"><h2>📜 ملفات التوكيلات</h2><p class="small">رقم الملف + اسم الموكل + رقم التوكيل + جهة التوثيق.</p><button class="btn" id="powersPage">فتح التوكيلات</button></div>
    </div>
  </div></div>`;
  document.getElementById("logout").onclick=()=>{localStorage.removeItem(tokenKey);loginView();};
  document.getElementById("searchPage").onclick=()=>location.hash="search";
  document.getElementById("casesPage").onclick=()=>location.hash="cases";
  document.getElementById("powersPage").onclick=()=>location.hash="powers";
  try{
    const d=await api("/dashboard");
    stats.innerHTML=`<div class="stat card"><div class="small">ملفات الحفظ</div><div class="num">${d.cases}</div></div>
    <div class="stat card"><div class="small">التوكيلات</div><div class="num">${d.powers}</div></div>
    <div class="stat card"><div class="small">الحالة</div><div class="num" style="font-size:22px">متصلة</div></div>`;
  }catch(e){stats.innerHTML=`<div class="notice">${esc(e.message)}</div>`;}
}

function modal(title,fields,onSave){
  const m=document.createElement("div");m.className="modal-back";
  m.innerHTML=`<div class="modal card"><div class="header"><h3>${esc(title)}</h3><button class="btn secondary" id="close">إغلاق</button></div>
  <form id="mf">${fields.map(f=>`<label>${esc(f.label)}<input id="${esc(f.id)}" value="${esc(f.value||"")}" ${f.required===false?"":"required"}></label>`).join("")}
  <button class="btn full">حفظ</button><div id="me" class="error"></div></form></div>`;
  document.body.appendChild(m);m.querySelector("#close").onclick=()=>m.remove();
  m.querySelector("#mf").onsubmit=async e=>{
    e.preventDefault();const v={};fields.forEach(f=>v[f.id]=m.querySelector("#"+f.id).value.trim());
    try{await onSave(v);m.remove();}catch(err){m.querySelector("#me").textContent=err.message;}
  };
}

async function casesView(){
  if(!token()) return loginView();
  app.innerHTML=shell("ملفات الحفظ","إدارة ملفات الحفظ");bindCommon();
  const c=document.getElementById("content");let page=1, q="", incomplete=false;
  async function render(){
    c.innerHTML=`<div class="toolbar"><input id="q" class="search" placeholder="ابحث برقم الملف أو اسم الموكل" value="${esc(q)}">
      <button class="btn" id="search">بحث</button><button class="btn secondary" id="inc">البيانات الناقصة</button>
      <button class="btn success" id="add">+ إضافة</button><button class="btn" id="import">استيراد Excel</button>
      <input id="file" class="hidden" type="file" accept=".xlsx,.xls,.csv"></div>
      <div class="notice">البيانات مخفية افتراضيًا. لن تظهر إلا بعد البحث أو اختيار البيانات الناقصة.</div><div id="table"></div><div id="pages" class="pagination"></div>`;
    document.getElementById("search").onclick=()=>{q=document.getElementById("q").value.trim();incomplete=false;page=1;load();};
    document.getElementById("inc").onclick=()=>{q="";incomplete=true;page=1;load();};
    document.getElementById("add").onclick=add;document.getElementById("import").onclick=()=>file.click();file.onchange=importFile;
    await load();
  }
  async function load(){
    const d=await api(`/cases?q=${encodeURIComponent(q)}&incomplete=${incomplete?1:0}&page=${page}&limit=50`);
    table.innerHTML=!d.data.length?`<div class="notice">لا توجد نتائج.</div>`:`<div class="table-wrap"><table><thead><tr><th>رقم الملف</th><th>اسم الموكل</th><th>إجراءات</th></tr></thead><tbody>
      ${d.data.map(r=>`<tr><td>${esc(r.file_number)}</td><td>${esc(r.client_name)}</td><td class="actions"><button class="btn secondary e" data-id="${r.id}">تعديل</button><button class="btn danger d" data-id="${r.id}">حذف</button></td></tr>`).join("")}</tbody></table></div>`;
    table.querySelectorAll(".e").forEach(b=>b.onclick=()=>edit(d.data.find(x=>x.id==b.dataset.id)));
    table.querySelectorAll(".d").forEach(b=>b.onclick=()=>del(b.dataset.id));
    const p=d.pagination;pages.innerHTML=`<button class="btn secondary" id="pr" ${p.page<=1?"disabled":""}>السابق</button><span>صفحة ${p.page} من ${p.pages} — ${p.total} سجل</span><button class="btn secondary" id="nx" ${p.page>=p.pages?"disabled":""}>التالي</button>`;
    pr.onclick=()=>{if(page>1){page--;load()}};nx.onclick=()=>{if(page<p.pages){page++;load()}};
  }
  async function add(){const l=await api("/cases/last-file");modal("إضافة ملف حفظ",[{id:"file_number",label:"رقم الملف",value:l.next},{id:"client_name",label:"اسم الموكل"}],async v=>{await api("/cases",{method:"POST",body:JSON.stringify(v)});q=v.file_number;incomplete=false;page=1;await load();});}
  function edit(r){modal("تعديل ملف الحفظ",[{id:"file_number",label:"رقم الملف",value:r.file_number},{id:"client_name",label:"اسم الموكل",value:r.client_name}],async v=>{await api(`/cases/${r.id}`,{method:"PUT",body:JSON.stringify(v)});await load();});}
  async function del(id){if(!confirm("هل تريد حذف هذا الملف؟"))return;await api(`/cases/${id}`,{method:"DELETE"});await load();}
  async function importFile(e){const f=e.target.files[0];if(!f)return;const fd=new FormData();fd.append("file",f);try{const d=await api("/import/cases",{method:"POST",body:fd});alert(`تم الحفظ\nالإجمالي: ${d.total}\nتمت الإضافة: ${d.inserted}\nالمكرر: ${d.duplicate}\nالناقص: ${d.incomplete}\nالصفوف الفارغة: ${d.skipped}`);q="";incomplete=false;await render();}catch(err){alert(err.message)}e.target.value="";}
  await render();
}

async function powersView(){
  if(!token()) return loginView();
  app.innerHTML=shell("ملفات التوكيلات","إدارة ملفات التوكيلات");bindCommon();
  const c=document.getElementById("content");let page=1,q="",incomplete=false;
  async function render(){
    c.innerHTML=`<div class="toolbar"><input id="q" class="search" placeholder="رقم الملف أو اسم الموكل أو رقم التوكيل أو جهة التوثيق" value="${esc(q)}">
      <button class="btn" id="search">بحث</button><button class="btn secondary" id="inc">البيانات الناقصة</button>
      <button class="btn success" id="add">+ إضافة</button><button class="btn" id="import">استيراد Excel</button><input id="file" class="hidden" type="file" accept=".xlsx,.xls,.csv"></div>
      <div class="notice">البيانات مخفية افتراضيًا. التكرار والبيانات الناقصة يتم حفظها عند الاستيراد ولا تمنع الإضافة.</div><div id="table"></div><div id="pages" class="pagination"></div>`;
    document.getElementById("search").onclick=()=>{q=document.getElementById("q").value.trim();incomplete=false;page=1;load();};
    document.getElementById("inc").onclick=()=>{q="";incomplete=true;page=1;load();};
    document.getElementById("add").onclick=add;document.getElementById("import").onclick=()=>file.click();file.onchange=importFile;await load();
  }
  async function load(){
    const d=await api(`/powers?q=${encodeURIComponent(q)}&incomplete=${incomplete?1:0}&page=${page}&limit=50`);
    table.innerHTML=!d.data.length?`<div class="notice">لا توجد نتائج.</div>`:`<div class="table-wrap"><table><thead><tr><th>رقم الملف</th><th>اسم الموكل</th><th>رقم التوكيل</th><th>جهة التوثيق</th><th>إجراءات</th></tr></thead><tbody>
      ${d.data.map(r=>`<tr><td>${esc(r.file_number)}</td><td>${esc(r.client_name)}</td><td>${esc(r.power_number)}</td><td>${esc(r.documentation_authority)}</td><td class="actions"><button class="btn secondary e" data-id="${r.id}">تعديل</button><button class="btn danger d" data-id="${r.id}">حذف</button></td></tr>`).join("")}</tbody></table></div>`;
    table.querySelectorAll(".e").forEach(b=>b.onclick=()=>edit(d.data.find(x=>x.id==b.dataset.id)));table.querySelectorAll(".d").forEach(b=>b.onclick=()=>del(b.dataset.id));
    const p=d.pagination;pages.innerHTML=`<button class="btn secondary" id="pr" ${p.page<=1?"disabled":""}>السابق</button><span>صفحة ${p.page} من ${p.pages} — ${p.total} سجل</span><button class="btn secondary" id="nx" ${p.page>=p.pages?"disabled":""}>التالي</button>`;
    pr.onclick=()=>{if(page>1){page--;load()}};nx.onclick=()=>{if(page<p.pages){page++;load()}};
  }
  async function add(){const l=await api("/powers/last-file");modal("إضافة توكيل",[{id:"file_number",label:"رقم الملف",value:l.next},{id:"client_name",label:"اسم الموكل"},{id:"power_number",label:"رقم التوكيل"},{id:"documentation_authority",label:"جهة التوثيق"}],async v=>{await api("/powers",{method:"POST",body:JSON.stringify(v)});q=v.power_number;incomplete=false;page=1;await load();});}
  function edit(r){modal("تعديل التوكيل",[{id:"file_number",label:"رقم الملف",value:r.file_number},{id:"client_name",label:"اسم الموكل",value:r.client_name},{id:"power_number",label:"رقم التوكيل",value:r.power_number},{id:"documentation_authority",label:"جهة التوثيق",value:r.documentation_authority}],async v=>{await api(`/powers/${r.id}`,{method:"PUT",body:JSON.stringify(v)});await load();});}
  async function del(id){if(!confirm("هل تريد حذف هذا التوكيل؟"))return;await api(`/powers/${id}`,{method:"DELETE"});await load();}
  async function importFile(e){const f=e.target.files[0];if(!f)return;const fd=new FormData();fd.append("file",f);try{const d=await api("/import/powers",{method:"POST",body:fd});alert(`تم الحفظ\nالإجمالي: ${d.total}\nتمت الإضافة: ${d.inserted}\nالمكرر: ${d.duplicate}\nالناقص: ${d.incomplete}\nالصفوف الفارغة: ${d.skipped}`);q="";incomplete=false;await render();}catch(err){alert(err.message)}e.target.value="";}
  await render();
}

async function searchView(){
  if(!token())return loginView();
  app.innerHTML=shell("البحث العام","البحث في ملفات الحفظ والتوكيلات");bindCommon();
  const c=document.getElementById("content");
  c.innerHTML=`<div class="toolbar"><input id="q" class="search" placeholder="اكتب اسم الموكل أو رقم الملف أو رقم التوكيل"><button class="btn" id="go">بحث</button></div>
  <div class="notice">لن تظهر أي بيانات قبل تنفيذ البحث.</div><div id="results"></div>`;
  async function go(){
    const q=document.getElementById("q").value.trim();if(!q){results.innerHTML='<div class="notice">اكتب كلمة للبحث.</div>';return;}
    try{
      const d=await api(`/search?q=${encodeURIComponent(q)}`);
      results.innerHTML=`<div class="search-result"><h3>📁 ملفات الحفظ (${d.cases.length})</h3>
        ${d.cases.length?`<div class="table-wrap"><table><thead><tr><th>رقم الملف</th><th>اسم الموكل</th></tr></thead><tbody>${d.cases.map(r=>`<tr><td>${esc(r.file_number)}</td><td>${esc(r.client_name)}</td></tr>`).join("")}</tbody></table></div>`:'<p class="small">لا توجد ملفات حفظ.</p>'}</div>
        <div class="search-result"><h3>📜 التوكيلات (${d.powers.length})</h3>
        ${d.powers.length?`<div class="table-wrap"><table><thead><tr><th>رقم الملف</th><th>اسم الموكل</th><th>رقم التوكيل</th><th>جهة التوثيق</th></tr></thead><tbody>${d.powers.map(r=>`<tr><td>${esc(r.file_number)}</td><td>${esc(r.client_name)}</td><td>${esc(r.power_number)}</td><td>${esc(r.documentation_authority)}</td></tr>`).join("")}</tbody></table></div>`:'<p class="small">لا توجد توكيلات.</p>'}</div>`;
    }catch(e){results.innerHTML=`<div class="error">${esc(e.message)}</div>`;}
  }
  document.getElementById("go").onclick=go;
  document.getElementById("q").onkeydown=e=>{if(e.key==="Enter")go();};
}

function route(){
  if(!token())return loginView();
  const r=(location.hash||"").replace("#","");
  if(r==="cases")casesView();
  else if(r==="powers")powersView();
  else if(r==="search")searchView();
  else dashboard();
}
window.addEventListener("hashchange",route);
route();
