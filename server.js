require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const XLSX = require("xlsx");
const { query, ensureDatabase } = require("./database");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_ENV";
const FRONTEND_DIR = __dirname;

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function normalizeKey(key) {
  return String(key ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    out[normalizeKey(key)] = String(value ?? "").trim();
  }
  return out;
}

function pick(row, keys) {
  for (const key of keys) {
    const k = normalizeKey(key);
    if (Object.prototype.hasOwnProperty.call(row, k)) {
      const value = String(row[k] ?? "").trim();
      if (value) return value;
    }
  }
  return "";
}

function anyValue(row) {
  return Object.values(row).some(v => String(v ?? "").trim() !== "");
}

function caseFile(row) {
  return pick(row, ["رقم_الملف","رقم الملف","م","file_number","filenumber","file number"]);
}
function client(row) {
  return pick(row, ["اسم_الموكل","اسم الموكل","اسم الموكل ","client_name","clientname","client name"]);
}
function powerNumber(row) {
  return pick(row, ["رقم_التوكيل","رقم التوكيل","power_number","powernumber","power number"]);
}
function authority(row) {
  return pick(row, ["جهة_إصدار","جهة إصدار","جهة_التوثيق","جهة التوثيق","documentation_authority","authority","documentation authority"]);
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "يرجى تسجيل الدخول" });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "انتهت جلسة الدخول. سجل الدخول مرة أخرى." });
  }
}

async function ensureAdmin() {
  const r = await query("SELECT id FROM users WHERE username=$1", ["admin"]);
  if (!r.rowCount) {
    await query(
      "INSERT INTO users(username,password_hash) VALUES($1,$2)",
      ["admin", hashPassword("admin123")]
    );
  }
}

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const r = await query("SELECT id,username,password_hash FROM users WHERE username=$1", [username]);
    const user = r.rows[0];
    if (!user || hashPassword(password) !== user.password_hash) {
      return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول" });
  }
});

app.get("/api/dashboard", auth, async (req, res) => {
  try {
    const [c, p] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM cases"),
      query("SELECT COUNT(*)::int AS count FROM powers")
    ]);
    res.json({ cases: c.rows[0].count, powers: p.rows[0].count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر قراءة قاعدة البيانات" });
  }
});

function pagination(req, total) {
  const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || "50", 10) || 50));
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  return { page: safePage, limit, pages, offset: (safePage - 1) * limit };
}

app.get("/api/cases", auth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const incomplete = String(req.query.incomplete || "0") === "1";

    // حماية: لا تعرض أي بيانات عاديًا. يجب البحث أو طلب الناقص.
    if (!q && !incomplete) {
      return res.json({ data: [], pagination: { page: 1, limit: 50, total: 0, pages: 1 } });
    }

    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(file_number ILIKE $${params.length} OR client_name ILIKE $${params.length})`);
    }
    if (incomplete) {
      conditions.push(`(btrim(file_number)='' OR btrim(client_name)='')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const count = await query(`SELECT COUNT(*)::int AS count FROM cases ${where}`, params);
    const total = count.rows[0].count;
    const pg = pagination(req, total);

    const data = await query(
      `SELECT id,file_number,client_name,created_at,updated_at
       FROM cases ${where}
       ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pg.limit, pg.offset]
    );

    res.json({ data: data.rows, pagination: { page: pg.page, limit: pg.limit, total, pages: pg.pages } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر تحميل ملفات الحفظ" });
  }
});

app.get("/api/cases/last-file", auth, async (req, res) => {
  try {
    const r = await query(`
      SELECT COALESCE(MAX(NULLIF(regexp_replace(file_number,'[^0-9]','','g'),'')::bigint),0) AS last
      FROM cases
    `);
    const last = Number(r.rows[0].last || 0);
    res.json({ last, next: last > 0 ? last + 1 : 1 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر حساب رقم الملف التالي" });
  }
});

app.post("/api/cases", auth, async (req, res) => {
  try {
    const fileNumber = String(req.body.file_number ?? "").trim();
    const clientName = String(req.body.client_name ?? "").trim();
    const r = await query(
      `INSERT INTO cases(file_number,client_name) VALUES($1,$2)
       RETURNING id,file_number,client_name,created_at,updated_at`,
      [fileNumber, clientName]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر إضافة ملف الحفظ" });
  }
});

app.put("/api/cases/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await query(
      `UPDATE cases SET file_number=$1,client_name=$2,updated_at=NOW()
       WHERE id=$3 RETURNING id,file_number,client_name,created_at,updated_at`,
      [String(req.body.file_number ?? "").trim(), String(req.body.client_name ?? "").trim(), id]
    );
    if (!r.rowCount) return res.status(404).json({ message: "ملف الحفظ غير موجود" });
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر تعديل ملف الحفظ" });
  }
});

app.delete("/api/cases/:id", auth, async (req, res) => {
  try {
    const r = await query("DELETE FROM cases WHERE id=$1", [Number(req.params.id)]);
    if (!r.rowCount) return res.status(404).json({ message: "ملف الحفظ غير موجود" });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر حذف ملف الحفظ" });
  }
});

app.post("/api/import/cases", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "لم يتم اختيار ملف" });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    if (!workbook.SheetNames.length) return res.status(400).json({ message: "ملف Excel فارغ" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    let inserted = 0, skipped = 0, duplicate = 0, incomplete = 0;

    for (const raw of rows) {
      const row = normalizeRow(raw);
      if (!anyValue(row)) { skipped++; continue; }

      const fileNumber = caseFile(row);
      const clientName = client(row);

      if (!fileNumber || !clientName) incomplete++;

      if (fileNumber) {
        const dup = await query("SELECT 1 FROM cases WHERE file_number=$1 LIMIT 1", [fileNumber]);
        if (dup.rowCount) duplicate++;
      }

      // لا نرفض المكرر ولا الناقص.
      await query("INSERT INTO cases(file_number,client_name) VALUES($1,$2)", [fileNumber, clientName]);
      inserted++;
    }

    res.json({ success:true, total:rows.length, inserted, skipped, duplicate, incomplete });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "حدث خطأ أثناء استيراد ملفات الحفظ" });
  }
});

app.get("/api/powers", auth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const incomplete = String(req.query.incomplete || "0") === "1";

    if (!q && !incomplete) {
      return res.json({ data: [], pagination: { page: 1, limit: 50, total: 0, pages: 1 } });
    }

    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(
        file_number ILIKE $${params.length} OR
        client_name ILIKE $${params.length} OR
        power_number ILIKE $${params.length} OR
        documentation_authority ILIKE $${params.length}
      )`);
    }

    if (incomplete) {
      conditions.push(`(
        btrim(file_number)='' OR
        btrim(client_name)='' OR
        btrim(power_number)='' OR
        btrim(documentation_authority)=''
      )`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const count = await query(`SELECT COUNT(*)::int AS count FROM powers ${where}`, params);
    const total = count.rows[0].count;
    const pg = pagination(req, total);

    const data = await query(
      `SELECT id,file_number,client_name,power_number,documentation_authority,created_at,updated_at
       FROM powers ${where}
       ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pg.limit, pg.offset]
    );

    res.json({ data:data.rows, pagination:{ page:pg.page, limit:pg.limit, total, pages:pg.pages } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر تحميل التوكيلات" });
  }
});

app.get("/api/powers/last-file", auth, async (req, res) => {
  try {
    const r = await query(`
      SELECT GREATEST(
        2431,
        COALESCE(MAX(NULLIF(regexp_replace(file_number,'[^0-9]','','g'),'')::bigint),0)
      ) AS last
      FROM powers
    `);
    const last = Number(r.rows[0].last || 2431);
    res.json({ last, next:last + 1 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر حساب رقم الملف التالي" });
  }
});

app.post("/api/powers", auth, async (req, res) => {
  try {
    const r = await query(
      `INSERT INTO powers(file_number,client_name,power_number,documentation_authority)
       VALUES($1,$2,$3,$4)
       RETURNING id,file_number,client_name,power_number,documentation_authority,created_at,updated_at`,
      [
        String(req.body.file_number ?? "").trim(),
        String(req.body.client_name ?? "").trim(),
        String(req.body.power_number ?? "").trim(),
        String(req.body.documentation_authority ?? "").trim()
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "تعذر إضافة التوكيل" });
  }
});

app.put("/api/powers/:id", auth, async (req, res) => {
  try {
    const r = await query(
      `UPDATE powers SET file_number=$1,client_name=$2,power_number=$3,documentation_authority=$4,updated_at=NOW()
       WHERE id=$5
       RETURNING id,file_number,client_name,power_number,documentation_authority,created_at,updated_at`,
      [
        String(req.body.file_number ?? "").trim(),
        String(req.body.client_name ?? "").trim(),
        String(req.body.power_number ?? "").trim(),
        String(req.body.documentation_authority ?? "").trim(),
        Number(req.params.id)
      ]
    );
    if (!r.rowCount) return res.status(404).json({ message:"التوكيل غير موجود" });
    res.json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:"تعذر تعديل التوكيل" });
  }
});

app.delete("/api/powers/:id", auth, async (req, res) => {
  try {
    const r = await query("DELETE FROM powers WHERE id=$1", [Number(req.params.id)]);
    if (!r.rowCount) return res.status(404).json({ message:"التوكيل غير موجود" });
    res.json({ success:true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:"تعذر حذف التوكيل" });
  }
});

app.post("/api/import/powers", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message:"لم يتم اختيار ملف" });

    const workbook = XLSX.read(req.file.buffer, { type:"buffer" });
    if (!workbook.SheetNames.length) return res.status(400).json({ message:"ملف Excel فارغ" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval:"" });

    let inserted=0, skipped=0, duplicate=0, incomplete=0;

    for (const raw of rows) {
      const row = normalizeRow(raw);
      if (!anyValue(row)) { skipped++; continue; }

      const fileNumber = caseFile(row);
      const clientName = client(row);
      const powerNum = powerNumber(row);
      const authName = authority(row);

      if (!fileNumber || !clientName || !powerNum || !authName) incomplete++;

      if (powerNum) {
        const dup = await query("SELECT 1 FROM powers WHERE power_number=$1 LIMIT 1", [powerNum]);
        if (dup.rowCount) duplicate++;
      }

      // لا نرفض المكرر ولا الناقص.
      await query(
        `INSERT INTO powers(file_number,client_name,power_number,documentation_authority)
         VALUES($1,$2,$3,$4)`,
        [fileNumber,clientName,powerNum,authName]
      );
      inserted++;
    }

    res.json({ success:true,total:rows.length,inserted,skipped,duplicate,incomplete });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:"حدث خطأ أثناء استيراد التوكيلات" });
  }
});

app.get("/api/search", auth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ message:"اكتب اسم الموكل أو جزءًا منه" });

    const like = `%${q}%`;
    const [cases, powers] = await Promise.all([
      query(
        `SELECT id,file_number,client_name,created_at
         FROM cases
         WHERE client_name ILIKE $1 OR file_number ILIKE $1
         ORDER BY id DESC LIMIT 100`,
        [like]
      ),
      query(
        `SELECT id,file_number,client_name,power_number,documentation_authority,created_at
         FROM powers
         WHERE client_name ILIKE $1
            OR file_number ILIKE $1
            OR power_number ILIKE $1
            OR documentation_authority ILIKE $1
         ORDER BY id DESC LIMIT 100`,
        [like]
      )
    ]);

    res.json({ query:q, cases:cases.rows, powers:powers.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message:"تعذر تنفيذ البحث العام" });
  }
});

app.get("/api/health", async (req,res) => {
  try {
    await query("SELECT 1");
    res.json({ ok:true, database:"connected" });
  } catch {
    res.status(503).json({ ok:false, database:"disconnected" });
  }
});

// Static frontend AFTER API routes.
app.use(express.static(FRONTEND_DIR));

app.get(/.*/, (req,res) => {
  res.sendFile(path.join(FRONTEND_DIR,"index.html"));
});

(async () => {
  try {
    await ensureDatabase();
    await ensureAdmin();
    app.listen(PORT, () => {
      console.log(`MIZAN ONLINE running on port ${PORT}`);
      console.log("Database: PostgreSQL");
      console.log("Admin: admin / admin123");
    });
  } catch (e) {
    console.error("STARTUP ERROR:", e);
    process.exit(1);
  }
})();
