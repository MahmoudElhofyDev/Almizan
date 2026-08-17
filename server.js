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

const JWT_SECRET =
  process.env.JWT_SECRET || "CHANGE_ME_IN_ENV";

const FRONTEND_DIR = __dirname;


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(cors());

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb"
  })
);


/* =====================================================
   EXCEL UPLOAD
===================================================== */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 20 * 1024 * 1024
  }
});


/* =====================================================
   PASSWORD
===================================================== */

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}


/* =====================================================
   TEXT NORMALIZATION
===================================================== */

function normalizeText(value) {
  let text = String(value ?? "");

  text = text
    .normalize("NFKC")
    .toLowerCase()
    .trim();

  // إزالة التشكيل
  text = text.replace(
    /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,
    ""
  );

  // توحيد الحروف العربية
  text = text
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");

  // إزالة التطويل
  text = text.replace(/ـ/g, "");

  // إزالة BOM و Zero Width
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // توحيد المسافات
  text = text.replace(/\s+/g, " ");

  return text.trim();
}


/* =====================================================
   EXCEL KEY NORMALIZATION
   أقوى من normalizeText العادي
===================================================== */

function normalizeKey(key) {
  let text = normalizeText(key);

  /*
    توحيد:
    -
    _
    /
    \
    .
    :
    والمسافات

    مثال:

    جهة إصدار
    جهة_إصدار
    جهة-إصدار
    جهة / إصدار

    كلها تصبح تقريبًا:

    جههاصدار
  */

  text = text.replace(
    /[\s_\-\/\\.:|]+/g,
    ""
  );

  return text;
}


/* =====================================================
   NORMALIZE EXCEL ROW
===================================================== */

function normalizeRow(row) {
  const out = {};

  for (const [key, value] of Object.entries(row || {})) {
    const normalized = normalizeKey(key);

    if (!normalized) {
      continue;
    }

    out[normalized] =
      String(value ?? "").trim();
  }

  return out;
}


/* =====================================================
   PICK VALUE
===================================================== */

function pick(row, keys) {
  for (const key of keys) {
    const normalized = normalizeKey(key);

    if (
      Object.prototype.hasOwnProperty.call(
        row,
        normalized
      )
    ) {
      const value =
        String(row[normalized] ?? "").trim();

      if (value !== "") {
        return value;
      }
    }
  }

  return "";
}


/* =====================================================
   CASE FILE
===================================================== */

function caseFile(row) {
  return pick(row, [
    "رقم_الملف",
    "رقم الملف",
    "رقم الملف ",
    "م",
    "رقم",
    "رقم الملف",
    "file_number",
    "filenumber",
    "file number",
    "file no",
    "file_no"
  ]);
}


/* =====================================================
   CLIENT
===================================================== */

function client(row) {
  return pick(row, [
    "اسم_الموكل",
    "اسم الموكل",
    "اسم الموكل ",
    "اسم العميل",
    "اسم_العميل",
    "client_name",
    "clientname",
    "client name",
    "client"
  ]);
}


/* =====================================================
   POWER NUMBER
===================================================== */

function powerNumber(row) {
  return pick(row, [
    "رقم_التوكيل",
    "رقم التوكيل",
    "رقم التوكيل ",
    "رقم الوكالة",
    "رقم_الوكالة",
    "power_number",
    "powernumber",
    "power number",
    "power_no",
    "power no",
    "power"
  ]);
}


/* =====================================================
   AUTHORITY
   جهة إصدار / جهة التوثيق
===================================================== */

function authority(row) {

  /*
    أولًا نحاول الأسماء المعروفة
  */

  const direct = pick(row, [

    // جهة إصدار
    "جهة إصدار",
    "جهة إصدار ",
    "جهة_إصدار",
    "جهة-إصدار",
    "جهه إصدار",
    "جهه_إصدار",
    "جهة الاصدار",
    "جهة_الاصدار",
    "جهه الاصدار",
    "جهه_الاصدار",

    // جهة التوثيق
    "جهة التوثيق",
    "جهة التوثيق ",
    "جهة_التوثيق",
    "جهة-التوثيق",
    "جهه التوثيق",
    "جهه_التوثيق",
    "جهة التوثيق / الإصدار",
    "جهة التوثيق/الإصدار",
    "جهة التوثيق والاصدار",
    "جهة التوثيق والاصدار ",
    "جهة التوثيق والاصدار",
    "التوثيق",

    // English
    "authority",
    "documentation_authority",
    "documentation authority",
    "documentation",
    "issuing_authority",
    "issuing authority"
  ]);

  if (direct !== "") {
    return direct;
  }


  /*
    =================================================
    FALLBACK
    =================================================

    لو Excel كتب اسم العمود بطريقة مختلفة جدًا،
    نبحث عن أي مفتاح يحتوي على:

    إصدار / اصدار
    توثيق
    issuing
    documentation
  */

  for (const [key, value] of Object.entries(row || {})) {

    const normalizedKey =
      normalizeKey(key);

    const valueText =
      String(value ?? "").trim();

    if (!valueText) {
      continue;
    }

    if (
      normalizedKey.includes(
        normalizeKey("جهةإصدار")
      ) ||

      normalizedKey.includes(
        normalizeKey("جهةاصدار")
      ) ||

      normalizedKey.includes(
        normalizeKey("إصدار")
      ) ||

      normalizedKey.includes(
        normalizeKey("اصدار")
      ) ||

      normalizedKey.includes(
        normalizeKey("توثيق")
      ) ||

      normalizedKey.includes(
        "issuing"
      ) ||

      normalizedKey.includes(
        "documentation"
      ) ||

      normalizedKey.includes(
        "authority"
      )
    ) {
      return valueText;
    }
  }

  return "";
}


/* =====================================================
   AUTH
===================================================== */

function auth(req, res, next) {

  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "يرجى تسجيل الدخول"
    });
  }

  try {

    req.user = jwt.verify(
      header.slice(7),
      JWT_SECRET
    );

    next();

  } catch {

    return res.status(401).json({
      message:
        "انتهت جلسة الدخول. سجل الدخول مرة أخرى."
    });
  }
}


/* =====================================================
   ADMIN
===================================================== */

async function ensureAdmin() {

  const r = await query(
    "SELECT id FROM users WHERE username=$1",
    ["admin"]
  );

  if (!r.rowCount) {

    await query(
      `
      INSERT INTO users(
        username,
        password_hash
      )
      VALUES($1,$2)
      `,
      [
        "admin",
        hashPassword("admin123")
      ]
    );
  }
}


/* =====================================================
   LOGIN
===================================================== */

app.post(
  "/api/login",
  async (req, res) => {

    try {

      const username =
        String(
          req.body.username || ""
        ).trim();

      const password =
        String(
          req.body.password || ""
        );

      const r = await query(
        `
        SELECT
          id,
          username,
          password_hash
        FROM users
        WHERE username=$1
        `,
        [username]
      );

      const user = r.rows[0];

      if (
        !user ||
        hashPassword(password) !==
          user.password_hash
      ) {

        return res.status(401).json({
          message:
            "اسم المستخدم أو كلمة المرور غير صحيحة"
        });
      }

      const token =
        jwt.sign(
          {
            id: user.id,
            username: user.username
          },
          JWT_SECRET,
          {
            expiresIn: "7d"
          }
        );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username
        }
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "حدث خطأ أثناء تسجيل الدخول"
      });
    }
  }
);


/* =====================================================
   DASHBOARD
===================================================== */

app.get(
  "/api/dashboard",
  auth,
  async (req, res) => {

    try {

      const [c, p] =
        await Promise.all([

          query(
            "SELECT COUNT(*)::int AS count FROM cases"
          ),

          query(
            "SELECT COUNT(*)::int AS count FROM powers"
          )

        ]);

      res.json({
        cases: c.rows[0].count,
        powers: p.rows[0].count
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر قراءة قاعدة البيانات"
      });
    }
  }
);


/* =====================================================
   PAGINATION
===================================================== */

function pagination(req, total) {

  const page =
    Math.max(
      1,
      Number.parseInt(
        req.query.page || "1",
        10
      ) || 1
    );

  const limit =
    Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(
          req.query.limit || "50",
          10
        ) || 50
      )
    );

  const pages =
    Math.max(
      1,
      Math.ceil(total / limit)
    );

  const safePage =
    Math.min(page, pages);

  return {
    page: safePage,
    limit,
    pages,
    offset:
      (safePage - 1) * limit
  };
}


/* =====================================================
   SQL ARABIC NORMALIZATION
===================================================== */

function sqlNormalize(column) {

  return `
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                lower(coalesce(${column}, '')),
                '[أإآٱ]',
                'ا',
                'g'
              ),
              'ى',
              'ي',
              'g'
            ),
            'ة',
            'ه',
            'g'
          ),
          'ؤ',
          'و',
          'g'
        ),
        'ئ',
        'ي',
        'g'
      ),
      '[^[:alnum:]ء-ي]+',
      ' ',
      'g'
    )
  `;
}


/* =====================================================
   SMART SEARCH
===================================================== */

function buildSmartSearch(
  search,
  columns,
  params
) {

  const normalized =
    normalizeText(search);

  if (!normalized) {
    return "";
  }

  const words =
    normalized
      .split(/\s+/)
      .map(x => x.trim())
      .filter(Boolean);

  if (!words.length) {
    return "";
  }

  const groups = [];

  for (const word of words) {

    const parameter =
      `%${word}%`;

    params.push(parameter);

    const index =
      params.length;

    const conditions =
      columns.map(
        column =>
          `${sqlNormalize(column)} LIKE $${index}`
      );

    groups.push(
      `(${conditions.join(" OR ")})`
    );
  }

  return groups.join(" AND ");
}


/* =====================================================
   CASES
===================================================== */

app.get(
  "/api/cases",
  auth,
  async (req, res) => {

    try {

      const q =
        String(
          req.query.q || ""
        ).trim();

      const incomplete =
        String(
          req.query.incomplete || "0"
        ) === "1";

      if (!q && !incomplete) {

        return res.json({
          data: [],
          pagination: {
            page: 1,
            limit: 50,
            total: 0,
            pages: 1
          }
        });
      }

      const conditions = [];
      const params = [];

      if (q) {

        const search =
          buildSmartSearch(
            q,
            [
              "file_number",
              "client_name"
            ],
            params
          );

        if (search) {
          conditions.push(search);
        }
      }

      if (incomplete) {

        conditions.push(`
          (
            btrim(file_number)='' OR
            btrim(client_name)=''
          )
        `);
      }

      const where =
        conditions.length
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      const count =
        await query(
          `
          SELECT COUNT(*)::int AS count
          FROM cases
          ${where}
          `,
          params
        );

      const total =
        count.rows[0].count;

      const pg =
        pagination(
          req,
          total
        );

      const data =
        await query(
          `
          SELECT
            id,
            file_number,
            client_name,
            created_at,
            updated_at
          FROM cases
          ${where}
          ORDER BY id DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
          `,
          [
            ...params,
            pg.limit,
            pg.offset
          ]
        );

      res.json({
        data: data.rows,

        pagination: {
          page: pg.page,
          limit: pg.limit,
          total,
          pages: pg.pages
        }
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر تحميل ملفات الحفظ"
      });
    }
  }
);


/* =====================================================
   LAST CASE FILE
===================================================== */

app.get(
  "/api/cases/last-file",
  auth,
  async (req, res) => {

    try {

      const r =
        await query(`
          SELECT
            COALESCE(
              MAX(
                NULLIF(
                  regexp_replace(
                    file_number,
                    '[^0-9]',
                    '',
                    'g'
                  ),
                  ''
                )::bigint
              ),
              0
            ) AS last
          FROM cases
        `);

      const last =
        Number(
          r.rows[0].last || 0
        );

      res.json({
        last,
        next:
          last > 0
            ? last + 1
            : 1
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر حساب رقم الملف التالي"
      });
    }
  }
);


/* =====================================================
   ADD CASE
===================================================== */

app.post(
  "/api/cases",
  auth,
  async (req, res) => {

    try {

      const fileNumber =
        String(
          req.body.file_number ?? ""
        ).trim();

      const clientName =
        String(
          req.body.client_name ?? ""
        ).trim();

      const r =
        await query(
          `
          INSERT INTO cases(
            file_number,
            client_name
          )
          VALUES($1,$2)
          RETURNING
            id,
            file_number,
            client_name,
            created_at,
            updated_at
          `,
          [
            fileNumber,
            clientName
          ]
        );

      res.status(201).json(
        r.rows[0]
      );

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر إضافة ملف الحفظ"
      });
    }
  }
);


/* =====================================================
   EDIT CASE
===================================================== */

app.put(
  "/api/cases/:id",
  auth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const r =
        await query(
          `
          UPDATE cases
          SET
            file_number=$1,
            client_name=$2,
            updated_at=NOW()
          WHERE id=$3
          RETURNING
            id,
            file_number,
            client_name,
            created_at,
            updated_at
          `,
          [
            String(
              req.body.file_number ?? ""
            ).trim(),

            String(
              req.body.client_name ?? ""
            ).trim(),

            id
          ]
        );

      if (!r.rowCount) {

        return res.status(404).json({
          message:
            "ملف الحفظ غير موجود"
        });
      }

      res.json(
        r.rows[0]
      );

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر تعديل ملف الحفظ"
      });
    }
  }
);


/* =====================================================
   DELETE CASE
===================================================== */

app.delete(
  "/api/cases/:id",
  auth,
  async (req, res) => {

    try {

      const r =
        await query(
          "DELETE FROM cases WHERE id=$1",
          [
            Number(
              req.params.id
            )
          ]
        );

      if (!r.rowCount) {

        return res.status(404).json({
          message:
            "ملف الحفظ غير موجود"
        });
      }

      res.json({
        success: true
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر حذف ملف الحفظ"
      });
    }
  }
);


/* =====================================================
   IMPORT CASES
===================================================== */

app.post(
  "/api/import/cases",
  auth,
  upload.single("file"),
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          message:
            "لم يتم اختيار ملف"
        });
      }

      const workbook =
        XLSX.read(
          req.file.buffer,
          {
            type: "buffer",
            cellDates: false
          }
        );

      if (!workbook.SheetNames.length) {

        return res.status(400).json({
          message:
            "ملف Excel فارغ"
        });
      }

      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const rows =
        XLSX.utils.sheet_to_json(
          sheet,
          {
            defval: "",
            raw: false
          }
        );

      let inserted = 0;

      for (const raw of rows) {

        const row =
          normalizeRow(raw);

        const fileNumber =
          caseFile(row);

        const clientName =
          client(row);

        await query(
          `
          INSERT INTO cases(
            file_number,
            client_name
          )
          VALUES($1,$2)
          `,
          [
            fileNumber,
            clientName
          ]
        );

        inserted++;
      }

      res.json({
        success: true,
        total: rows.length,
        inserted,
        skipped: 0,
        duplicate: 0,
        incomplete: 0
      });

    } catch (e) {

      console.error(
        "IMPORT CASES ERROR:",
        e
      );

      res.status(500).json({
        message:
          "حدث خطأ أثناء استيراد ملفات الحفظ",
        error:
          e.message
      });
    }
  }
);


/* =====================================================
   POWERS
===================================================== */

app.get(
  "/api/powers",
  auth,
  async (req, res) => {

    try {

      const q =
        String(
          req.query.q || ""
        ).trim();

      const incomplete =
        String(
          req.query.incomplete || "0"
        ) === "1";

      if (!q && !incomplete) {

        return res.json({
          data: [],
          pagination: {
            page: 1,
            limit: 50,
            total: 0,
            pages: 1
          }
        });
      }

      const conditions = [];
      const params = [];

      if (q) {

        const search =
          buildSmartSearch(
            q,
            [
              "file_number",
              "client_name",
              "power_number",
              "documentation_authority"
            ],
            params
          );

        if (search) {
          conditions.push(search);
        }
      }

      if (incomplete) {

        conditions.push(`
          (
            btrim(file_number)='' OR
            btrim(client_name)='' OR
            btrim(power_number)='' OR
            btrim(documentation_authority)=''
          )
        `);
      }

      const where =
        conditions.length
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      const count =
        await query(
          `
          SELECT COUNT(*)::int AS count
          FROM powers
          ${where}
          `,
          params
        );

      const total =
        count.rows[0].count;

      const pg =
        pagination(
          req,
          total
        );

      const data =
        await query(
          `
          SELECT
            id,
            file_number,
            client_name,
            power_number,
            documentation_authority,
            created_at,
            updated_at
          FROM powers
          ${where}
          ORDER BY id DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
          `,
          [
            ...params,
            pg.limit,
            pg.offset
          ]
        );

      res.json({
        data: data.rows,

        pagination: {
          page: pg.page,
          limit: pg.limit,
          total,
          pages: pg.pages
        }
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر تحميل التوكيلات"
      });
    }
  }
);


/* =====================================================
   LAST POWER FILE
===================================================== */

app.get(
  "/api/powers/last-file",
  auth,
  async (req, res) => {

    try {

      const r =
        await query(`
          SELECT
            GREATEST(
              2431,
              COALESCE(
                MAX(
                  NULLIF(
                    regexp_replace(
                      file_number,
                      '[^0-9]',
                      '',
                      'g'
                    ),
                    ''
                  )::bigint
                ),
                0
              )
            ) AS last
          FROM powers
        `);

      const last =
        Number(
          r.rows[0].last || 2431
        );

      res.json({
        last,
        next: last + 1
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر حساب رقم الملف التالي"
      });
    }
  }
);


/* =====================================================
   ADD POWER
===================================================== */

app.post(
  "/api/powers",
  auth,
  async (req, res) => {

    try {

      const fileNumber =
        String(
          req.body.file_number ?? ""
        ).trim();

      const clientName =
        String(
          req.body.client_name ?? ""
        ).trim();

      const powerNumber =
        String(
          req.body.power_number ?? ""
        ).trim();

      const documentationAuthority =
        String(
          req.body.documentation_authority ?? ""
        ).trim();

      if (powerNumber) {

        const duplicate =
          await query(
            `
            SELECT id
            FROM powers
            WHERE
              lower(trim(power_number))
              =
              lower(trim($1))
            LIMIT 1
            `,
            [powerNumber]
          );

        if (duplicate.rowCount) {

          return res.status(409).json({
            message:
              "رقم التوكيل موجود بالفعل ولا يمكن تكراره."
          });
        }
      }

      const r =
        await query(
          `
          INSERT INTO powers(
            file_number,
            client_name,
            power_number,
            documentation_authority
          )
          VALUES($1,$2,$3,$4)
          RETURNING
            id,
            file_number,
            client_name,
            power_number,
            documentation_authority,
            created_at,
            updated_at
          `,
          [
            fileNumber,
            clientName,
            powerNumber,
            documentationAuthority
          ]
        );

      res.status(201).json(
        r.rows[0]
      );

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر إضافة التوكيل"
      });
    }
  }
);


/* =====================================================
   EDIT POWER
===================================================== */

app.put(
  "/api/powers/:id",
  auth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const fileNumber =
        String(
          req.body.file_number ?? ""
        ).trim();

      const clientName =
        String(
          req.body.client_name ?? ""
        ).trim();

      const powerNumber =
        String(
          req.body.power_number ?? ""
        ).trim();

      const documentationAuthority =
        String(
          req.body.documentation_authority ?? ""
        ).trim();

      if (powerNumber) {

        const duplicate =
          await query(
            `
            SELECT id
            FROM powers
            WHERE
              lower(trim(power_number))
              =
              lower(trim($1))
              AND id <> $2
            LIMIT 1
            `,
            [
              powerNumber,
              id
            ]
          );

        if (duplicate.rowCount) {

          return res.status(409).json({
            message:
              "رقم التوكيل موجود بالفعل في سجل آخر."
          });
        }
      }

      const r =
        await query(
          `
          UPDATE powers
          SET
            file_number=$1,
            client_name=$2,
            power_number=$3,
            documentation_authority=$4,
            updated_at=NOW()
          WHERE id=$5
          RETURNING
            id,
            file_number,
            client_name,
            power_number,
            documentation_authority,
            created_at,
            updated_at
          `,
          [
            fileNumber,
            clientName,
            powerNumber,
            documentationAuthority,
            id
          ]
        );

      if (!r.rowCount) {

        return res.status(404).json({
          message:
            "التوكيل غير موجود"
        });
      }

      res.json(
        r.rows[0]
      );

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر تعديل التوكيل"
      });
    }
  }
);


/* =====================================================
   DELETE POWER
===================================================== */

app.delete(
  "/api/powers/:id",
  auth,
  async (req, res) => {

    try {

      const r =
        await query(
          "DELETE FROM powers WHERE id=$1",
          [
            Number(
              req.params.id
            )
          ]
        );

      if (!r.rowCount) {

        return res.status(404).json({
          message:
            "التوكيل غير موجود"
        });
      }

      res.json({
        success: true
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر حذف التوكيل"
      });
    }
  }
);


/* =====================================================
   IMPORT POWERS
   Excel:
   م
   اسم الموكل
   رقم التوكيل
   جهة إصدار
===================================================== */

app.post(
  "/api/import/powers",
  auth,
  upload.single("file"),
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          message:
            "لم يتم اختيار ملف"
        });
      }

      const workbook =
        XLSX.read(
          req.file.buffer,
          {
            type: "buffer",
            cellDates: false
          }
        );

      if (!workbook.SheetNames.length) {

        return res.status(400).json({
          message:
            "ملف Excel فارغ"
        });
      }

      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      /*
        قراءة Excel بالقيم الظاهرة
      */

      const rows =
        XLSX.utils.sheet_to_json(
          sheet,
          {
            defval: "",
            raw: false
          }
        );

      console.log(
        "================================================="
      );

      console.log(
        "IMPORT POWERS START"
      );

      console.log(
        "SHEET:",
        workbook.SheetNames[0]
      );

      console.log(
        "ROWS:",
        rows.length
      );

      let inserted = 0;

      for (let i = 0; i < rows.length; i++) {

        const raw =
          rows[i];

        const row =
          normalizeRow(raw);

        /*
          استخراج البيانات
        */

        const fileNumber =
          caseFile(row);

        const clientName =
          client(row);

        const powerNum =
          powerNumber(row);

        const authName =
          authority(row);

        /*
          LOG مهم جدًا لمعرفة ماذا قرأ Excel
        */

        console.log(
          `IMPORT POWER ROW ${i + 2}:`,
          {
            original: raw,
            normalized: row,
            fileNumber,
            clientName,
            powerNum,
            authName
          }
        );

        /*
          كل صف يدخل بدون:
          duplicate check
          skip
          incomplete skip
        */

        await query(
          `
          INSERT INTO powers(
            file_number,
            client_name,
            power_number,
            documentation_authority
          )
          VALUES($1,$2,$3,$4)
          `,
          [
            fileNumber,
            clientName,
            powerNum,
            authName
          ]
        );

        inserted++;
      }

      console.log(
        "IMPORT POWERS FINISHED:",
        {
          total: rows.length,
          inserted
        }
      );

      console.log(
        "================================================="
      );

      res.json({
        success: true,
        total: rows.length,
        inserted,
        skipped: 0,
        duplicate: 0,
        incomplete: 0
      });

    } catch (e) {

      console.error(
        "IMPORT POWERS ERROR:",
        e
      );

      res.status(500).json({
        message:
          "حدث خطأ أثناء استيراد التوكيلات",
        error:
          e.message
      });
    }
  }
);


/* =====================================================
   SMART GENERAL SEARCH
===================================================== */

app.get(
  "/api/search",
  auth,
  async (req, res) => {

    try {

      const q =
        String(
          req.query.q || ""
        ).trim();

      if (!q) {

        return res.status(400).json({
          message:
            "اكتب اسم الموكل أو جزءًا منه"
        });
      }

      const normalized =
        normalizeText(q);

      if (!normalized) {

        return res.status(400).json({
          message:
            "اكتب كلمة صحيحة للبحث"
        });
      }


      /* ================================
         CASES
      ================================= */

      const caseParams = [];

      const caseSearch =
        buildSmartSearch(
          normalized,
          [
            "file_number",
            "client_name"
          ],
          caseParams
        );

      const cases =
        await query(
          `
          SELECT
            id,
            file_number,
            client_name,
            created_at
          FROM cases
          WHERE ${caseSearch}
          ORDER BY id DESC
          LIMIT 200
          `,
          caseParams
        );


      /* ================================
         POWERS
      ================================= */

      const powerParams = [];

      const powerSearch =
        buildSmartSearch(
          normalized,
          [
            "file_number",
            "client_name",
            "power_number",
            "documentation_authority"
          ],
          powerParams
        );

      const powers =
        await query(
          `
          SELECT
            id,
            file_number,
            client_name,
            power_number,
            documentation_authority,
            created_at
          FROM powers
          WHERE ${powerSearch}
          ORDER BY id DESC
          LIMIT 200
          `,
          powerParams
        );

      res.json({

        query: q,

        normalized,

        cases:
          cases.rows,

        powers:
          powers.rows

      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر تنفيذ البحث العام"
      });
    }
  }
);


/* =====================================================
   CLEAR ALL DATA
   cases + powers
===================================================== */

app.delete(
  "/api/data/clear",
  auth,
  async (req, res) => {

    try {

      await query(
        "TRUNCATE TABLE cases, powers RESTART IDENTITY"
      );

      res.json({
        success: true,

        message:
          "تم حذف جميع ملفات الحفظ والتوكيلات"
      });

    } catch (e) {

      console.error(e);

      res.status(500).json({
        message:
          "تعذر حذف البيانات القديمة"
      });
    }
  }
);


/* =====================================================
   CLEAR POWERS ONLY
   مهم:
   لا يلمس cases نهائيًا
===================================================== */

app.delete(
  "/api/data/clear-powers",
  auth,
  async (req, res) => {

    try {

      await query(
        "TRUNCATE TABLE powers RESTART IDENTITY"
      );

      res.json({
        success: true,

        message:
          "تم حذف جميع ملفات التوكيلات فقط بنجاح"
      });

    } catch (e) {

      console.error(
        "CLEAR POWERS ERROR:",
        e
      );

      res.status(500).json({
        message:
          "تعذر حذف ملفات التوكيلات",

        error:
          e.message
      });
    }
  }
);


/* =====================================================
   HEALTH
===================================================== */

app.get(
  "/api/health",
  async (req, res) => {

    try {

      await query(
        "SELECT 1"
      );

      res.json({
        ok: true,
        database:
          "connected"
      });

    } catch {

      res.status(503).json({
        ok: false,
        database:
          "disconnected"
      });
    }
  }
);


/* =====================================================
   STATIC FRONTEND
===================================================== */

app.use(
  express.static(
    FRONTEND_DIR
  )
);


/* =====================================================
   SPA FALLBACK
===================================================== */

app.get(
  /.*/,
  (req, res) => {

    res.sendFile(
      path.join(
        FRONTEND_DIR,
        "index.html"
      )
    );
  }
);


/* =====================================================
   START
===================================================== */

(async () => {

  try {

    await ensureDatabase();

    await ensureAdmin();

    app.listen(
      PORT,
      () => {

        console.log(
          `MIZAN ONLINE running on port ${PORT}`
        );

        console.log(
          "Database: PostgreSQL"
        );

        console.log(
          "Admin: admin / admin123"
        );
      }
    );

  } catch (e) {

    console.error(
      "STARTUP ERROR:",
      e
    );

    process.exit(1);
  }

})();
