
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const XLSX = require("xlsx");
const { readDatabase, writeDatabase, ensureDatabase, DATA_FILE } = require("./database");

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "MIZAN_LOCAL_SECRET_CHANGE_ME";
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json({limit:"20mb"}));
app.use(express.urlencoded({extended:true,limit:"20mb"}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 20 * 1024 * 1024}
});

function hashPassword(p) {
  return crypto.createHash("sha256").update(String(p)).digest("hex");
}

function setup() {
  ensureDatabase();
  const db = readDatabase();
  if (!db.users.some(u => u.username === "admin")) {
    db.users.push({
      id: 1,
      username: "admin",
      password_hash: hashPassword("admin123"),
      created_at: new Date().toISOString()
    });
    writeDatabase(db);
  }
}
setup();

function auth(req,res,next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({message:"يرجى تسجيل الدخول"});
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({message:"جلسة الدخول غير صالحة"});
  }
}

app.post("/api/login",(req,res)=>{
  const db = readDatabase();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = db.users.find(u => u.username === username);
  if (!user || user.password_hash !== hashPassword(password))
    return res.status(401).json({message:"اسم المستخدم أو كلمة المرور غير صحيحة"});
  const token = jwt.sign({id:user.id,username:user.username},JWT_SECRET,{expiresIn:"7d"});
  res.json({success:true,token});
});

function clean(v) {
  return String(v ?? "").trim().replace(/\s+/g," ").toLowerCase();
}
function normKey(k) {
  return clean(k).replace(/^\uFEFF/,"");
}
function normalizeRow(row) {
  const out = {};
  for (const [k,v] of Object.entries(row)) out[normKey(k)] = String(v ?? "").trim();
  return out;
}
function pick(row, keys) {
  for (const k of keys) {
    const v = row[normKey(k)];
    if (String(v ?? "").trim() !== "") return String(v).trim();
  }
  return "";
}
function hasAny(row) {
  return Object.values(row).some(v => String(v ?? "").trim() !== "");
}
function caseFields(row) {
  return {
    file_number: pick(row,["رقم_الملف","رقم الملف","م","file_number","filenumber","file number"]),
    client_name: pick(row,["اسم_الموكل","اسم الموكل","client_name","clientname","client name"])
  };
}
function powerFields(row) {
  return {
    file_number: pick(row,["م","رقم_الملف","رقم الملف","file_number","filenumber","file number"]),
    client_name: pick(row,["اسم_الموكل","اسم الموكل","client_name","clientname","client name"]),
    power_number: pick(row,["رقم_التوكيل","رقم التوكيل","power_number","powernumber","power number"]),
    documentation_authority: pick(row,["جهة_إصدار","جهة إصدار","جهة_التوثيق","جهة التوثيق","documentation_authority","authority","documentation authority"])
  };
}
function sortNewest(a,b){ return Number(b.id)-Number(a.id); }
function paginate(records,req) {
  const page = Math.max(1, parseInt(req.query.page || "1",10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "50",10) || 50));
  const pages = Math.max(1, Math.ceil(records.length/limit));
  const safePage = Math.min(page,pages);
  return {data:records.slice((safePage-1)*limit,(safePage-1)*limit+limit),
    pagination:{page:safePage,limit,total:records.length,pages}};
}

app.get("/api/dashboard",auth,(req,res)=>{
  const db=readDatabase();
  res.json({cases:db.cases.length,powers:db.powers.length});
});

app.get("/api/cases",auth,(req,res)=>{
  const db=readDatabase();
  let records=[...db.cases];
  const q=clean(req.query.q || "");
  const incomplete=String(req.query.incomplete||"0")==="1";
  if (q) records=records.filter(r=>clean(r.file_number).includes(q)||clean(r.client_name).includes(q));
  if (incomplete) records=records.filter(r=>!clean(r.file_number)||!clean(r.client_name));
  records.sort(sortNewest);
  res.json(paginate(records,req));
});

app.get("/api/powers",auth,(req,res)=>{
  const db=readDatabase();
  let records=[...db.powers];
  const q=clean(req.query.q || "");
  const incomplete=String(req.query.incomplete||"0")==="1";
  if (q) records=records.filter(r=>
    clean(r.file_number).includes(q) ||
    clean(r.client_name).includes(q) ||
    clean(r.power_number).includes(q) ||
    clean(r.documentation_authority).includes(q)
  );
  if (incomplete) records=records.filter(r=>
    !clean(r.file_number)||!clean(r.client_name)||!clean(r.power_number)||!clean(r.documentation_authority)
  );
  records.sort(sortNewest);
  res.json(paginate(records,req));
});

app.get("/api/search",auth,(req,res)=>{
  const db=readDatabase();
  const q=clean(req.query.q || "");
  if (!q) return res.json({cases:[],powers:[]});
  const cases=db.cases.filter(r=>clean(r.client_name).includes(q)||clean(r.file_number).includes(q)).sort(sortNewest);
  const powers=db.powers.filter(r=>
    clean(r.client_name).includes(q) ||
    clean(r.file_number).includes(q) ||
    clean(r.power_number).includes(q) ||
    clean(r.documentation_authority).includes(q)
  ).sort(sortNewest);
  res.json({cases,powers});
});

app.get("/api/cases/last-file",auth,(req,res)=>{
  const db=readDatabase(); let max=0;
  for(const r of db.cases){
    const n=parseInt(String(r.file_number||"").replace(/\D/g,""),10);
    if(Number.isFinite(n)&&n>max) max=n;
  }
  res.json({last:max,next:max+1});
});

app.get("/api/powers/last-file",auth,(req,res)=>{
  const db=readDatabase(); let max=2431;
  for(const r of db.powers){
    const n=parseInt(String(r.file_number||"").replace(/\D/g,""),10);
    if(Number.isFinite(n)&&n>max) max=n;
  }
  res.json({last:max,next:max+1});
});

app.post("/api/cases",auth,(req,res)=>{
  const db=readDatabase(), now=new Date().toISOString();
  const r={id:db.nextCaseId++,file_number:String(req.body.file_number||"").trim(),client_name:String(req.body.client_name||"").trim(),created_at:now,updated_at:now};
  db.cases.push(r); writeDatabase(db); res.status(201).json(r);
});
app.post("/api/powers",auth,(req,res)=>{
  const db=readDatabase(), now=new Date().toISOString();
  const r={id:db.nextPowerId++,file_number:String(req.body.file_number||"").trim(),client_name:String(req.body.client_name||"").trim(),power_number:String(req.body.power_number||"").trim(),documentation_authority:String(req.body.documentation_authority||"").trim(),created_at:now,updated_at:now};
  db.powers.push(r); writeDatabase(db); res.status(201).json(r);
});

app.put("/api/cases/:id",auth,(req,res)=>{
  const db=readDatabase(), r=db.cases.find(x=>Number(x.id)===Number(req.params.id));
  if(!r) return res.status(404).json({message:"ملف الحفظ غير موجود"});
  r.file_number=String(req.body.file_number||"").trim(); r.client_name=String(req.body.client_name||"").trim(); r.updated_at=new Date().toISOString();
  writeDatabase(db); res.json(r);
});
app.put("/api/powers/:id",auth,(req,res)=>{
  const db=readDatabase(), r=db.powers.find(x=>Number(x.id)===Number(req.params.id));
  if(!r) return res.status(404).json({message:"التوكيل غير موجود"});
  r.file_number=String(req.body.file_number||"").trim(); r.client_name=String(req.body.client_name||"").trim(); r.power_number=String(req.body.power_number||"").trim(); r.documentation_authority=String(req.body.documentation_authority||"").trim(); r.updated_at=new Date().toISOString();
  writeDatabase(db); res.json(r);
});
app.delete("/api/cases/:id",auth,(req,res)=>{
  const db=readDatabase(), n=db.cases.length; db.cases=db.cases.filter(x=>Number(x.id)!==Number(req.params.id));
  if(db.cases.length===n) return res.status(404).json({message:"ملف الحفظ غير موجود"}); writeDatabase(db); res.json({success:true});
});
app.delete("/api/powers/:id",auth,(req,res)=>{
  const db=readDatabase(), n=db.powers.length; db.powers=db.powers.filter(x=>Number(x.id)!==Number(req.params.id));
  if(db.powers.length===n) return res.status(404).json({message:"التوكيل غير موجود"}); writeDatabase(db); res.json({success:true});
});

function importSheet(req,res,type){
  try {
    if(!req.file) return res.status(400).json({message:"لم يتم اختيار ملف"});
    const wb=XLSX.read(req.file.buffer,{type:"buffer"});
    if(!wb.SheetNames.length) return res.status(400).json({message:"ملف Excel فارغ"});
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
    const db=readDatabase(); let inserted=0, skipped=0, incomplete=0, duplicate=0;
    for(const raw of rows){
      const row=normalizeRow(raw);
      if(!hasAny(row)){skipped++;continue;}
      const f=type==="cases"?caseFields(row):powerFields(row);
      const duplicateExists=type==="cases"
        ? db.cases.some(x=>f.file_number && String(x.file_number)===f.file_number)
        : db.powers.some(x=>f.power_number && String(x.power_number)===f.power_number);
      if(duplicateExists) duplicate++;
      const missing=type==="cases" ? (!f.file_number||!f.client_name) : (!f.file_number||!f.client_name||!f.power_number||!f.documentation_authority);
      if(missing) incomplete++;
      const now=new Date().toISOString();
      if(type==="cases") db.cases.push({id:db.nextCaseId++,...f,created_at:now,updated_at:now});
      else db.powers.push({id:db.nextPowerId++,...f,created_at:now,updated_at:now});
      inserted++;
    }
    writeDatabase(db);
    res.json({success:true,total:rows.length,inserted,skipped,duplicate,incomplete});
  } catch(e) {
    console.error(e); res.status(500).json({message:"حدث خطأ أثناء الاستيراد"});
  }
}
app.post("/api/import/cases",auth,upload.single("file"),(req,res)=>importSheet(req,res,"cases"));
app.post("/api/import/powers",auth,upload.single("file"),(req,res)=>importSheet(req,res,"powers"));

app.get("/api/database-info",auth,(req,res)=>{
  const db=readDatabase();
  res.json({cases:db.cases.length,powers:db.powers.length,file:DATA_FILE});
});

if(fs.existsSync(FRONTEND_DIR)){
  app.use(express.static(FRONTEND_DIR));
  app.get("*",(req,res)=>res.sendFile(path.join(FRONTEND_DIR,"index.html")));
}

app.listen(PORT,()=>console.log(`MIZAN running: http://localhost:${PORT}`));
