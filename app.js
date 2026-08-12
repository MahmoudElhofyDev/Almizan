const app = document.getElementById("app");

const tokenKey = "mizan_token";

/* ====================================================
   MIZAN
   Frontend: GitHub Pages
   Backend: Railway
==================================================== */

const API_BASE =
  "https://almizan-production.up.railway.app/api";


/* ====================================================
   TOKEN
==================================================== */

function token() {
  return localStorage.getItem(tokenKey) || "";
}


/* ====================================================
   ESCAPE HTML
==================================================== */

function esc(value) {

  return String(value ?? "").replace(
    /[&<>"']/g,
    function (s) {

      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[s];

    }
  );

}


/* ====================================================
   API REQUEST
==================================================== */

async function api(url, options = {}) {

  const headers = {
    ...(options.headers || {})
  };


  if (options.body instanceof FormData) {

    headers.Authorization =
      "Bearer " + token();

  } else {

    headers["Content-Type"] =
      "application/json";

    headers.Authorization =
      "Bearer " + token();

  }


  const fullUrl =
    API_BASE + url;


  let response;


  try {

    response = await fetch(
      fullUrl,
      {
        ...options,
        headers
      }
    );

  } catch (error) {

    console.error(error);

    throw new Error(
      "تعذر الاتصال بالسيرفر. تأكد أن Railway يعمل."
    );

  }


  const text =
    await response.text();


  let data = {};


  try {

    data =
      text
        ? JSON.parse(text)
        : {};

  } catch (error) {

    console.error(
      "Server response:",
      text
    );

    throw new Error(
      "السيرفر لم يرجع JSON. تأكد من أن Backend يعمل على Railway."
    );

  }


  if (!response.ok) {

    if (response.status === 401) {

      localStorage.removeItem(tokenKey);

      loginView();

    }


    throw new Error(
      data.message ||
      data.error ||
      "حدث خطأ في السيرفر"
    );

  }


  return data;

}


/* ====================================================
   LOGIN VIEW
==================================================== */

function loginView() {

  app.innerHTML = `

    <div class="screen">

      <div class="login card">

        <div class="logo">
          مــيــزان
        </div>

        <p class="sub">
          إدارة مكتب المحاماة
        </p>


        <form id="loginForm">

          <label>
            اسم المستخدم
          </label>

          <input
            id="username"
            value="admin"
            required
          >


          <label>
            كلمة المرور
          </label>

          <input
            id="password"
            type="password"
            value="admin123"
            required
          >


          <button
            class="btn full"
            type="submit"
          >
            تسجيل الدخول
          </button>


          <div
            id="loginError"
            class="error"
          ></div>

        </form>

      </div>

    </div>

  `;


  const form =
    document.getElementById("loginForm");


  form.onsubmit =
    async function (e) {

      e.preventDefault();


      const errorBox =
        document.getElementById("loginError");


      errorBox.textContent =
        "";


      const username =
        document
          .getElementById("username")
          .value
          .trim();


      const password =
        document
          .getElementById("password")
          .value;


      try {

        const response =
          await fetch(
            `${API_BASE}/login`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  username,
                  password
                })
            }
          );


        const text =
          await response.text();


        let data = {};


        try {

          data =
            text
              ? JSON.parse(text)
              : {};

        } catch {

          throw new Error(
            "Backend لم يرجع JSON. تأكد أن رابط Railway صحيح ويعمل."
          );

        }


        if (!response.ok) {

          throw new Error(
            data.message ||
            data.error ||
            "فشل تسجيل الدخول"
          );

        }


        if (!data.token) {

          throw new Error(
            "لم يتم استلام Token من السيرفر."
          );

        }


        localStorage.setItem(
          tokenKey,
          data.token
        );


        location.hash =
          "";


        route();

      } catch (error) {

        console.error(error);


        errorBox.textContent =
          error.message ||
          "حدث خطأ أثناء تسجيل الدخول";

      }

    };

}


/* ====================================================
   COMMON SHELL
==================================================== */

function shell(title, sub) {

  return `

    <div class="screen">

      <div class="container">

        <div class="header">

          <div>

            <div class="logo">
              مــيــزان
            </div>

            <div class="sub">
              ${esc(sub)}
            </div>

          </div>


          <div class="header-actions">

            <button
              class="btn secondary"
              id="home"
            >
              ↩ العودة للرئيسية
            </button>


            <button
              class="btn danger"
              id="logout"
            >
              تسجيل الخروج
            </button>

          </div>

        </div>


        <div class="card page-card">

          <h2>
            ${esc(title)}
          </h2>

          <div id="content"></div>

        </div>

      </div>

    </div>

  `;

}


/* ====================================================
   COMMON BUTTONS
==================================================== */

function bindCommon() {

  const home =
    document.getElementById("home");


  const logout =
    document.getElementById("logout");


  if (home) {

    home.onclick =
      function () {

        location.hash =
          "";

      };

  }


  if (logout) {

    logout.onclick =
      function () {

        localStorage.removeItem(
          tokenKey
        );

        location.hash =
          "";

        loginView();

      };

  }

}


/* ====================================================
   DASHBOARD
==================================================== */

async function dashboard() {

  if (!token()) {

    return loginView();

  }


  app.innerHTML = `

    <div class="screen">

      <div class="container">

        <div class="header">

          <div>

            <div class="logo">
              مــيــزان
            </div>

            <div class="sub">
              لوحة التحكم الرئيسية
            </div>

          </div>


          <button
            class="btn danger"
            id="logout"
          >
            تسجيل الخروج
          </button>

        </div>


        <div
          class="grid three"
          id="stats"
        ></div>


        <div
          class="grid"
          style="margin-top:18px"
        >

          <div class="dashboard-card card">

            <h2>
              🔎 البحث العام
            </h2>

            <p class="small">
              ابحث عن الموكل لتظهر ملفات الحفظ والتوكيلات الخاصة به.
            </p>

            <button
              class="btn"
              id="searchPage"
            >
              فتح البحث العام
            </button>

          </div>


          <div class="dashboard-card card">

            <h2>
              📁 ملفات الحفظ
            </h2>

            <p class="small">
              إدارة ملفات الحفظ.
            </p>

            <button
              class="btn"
              id="casesPage"
            >
              فتح ملفات الحفظ
            </button>

          </div>


          <div class="dashboard-card card">

            <h2>
              📜 ملفات التوكيلات
            </h2>

            <p class="small">
              إدارة ملفات التوكيلات.
            </p>

            <button
              class="btn"
              id="powersPage"
            >
              فتح التوكيلات
            </button>

          </div>

        </div>

      </div>

    </div>

  `;


  document.getElementById("logout").onclick =
    function () {

      localStorage.removeItem(
        tokenKey
      );

      location.hash = "";

      loginView();

    };


  document.getElementById("searchPage").onclick =
    function () {

      location.hash =
        "search";

    };


  document.getElementById("casesPage").onclick =
    function () {

      location.hash =
        "cases";

    };


  document.getElementById("powersPage").onclick =
    function () {

      location.hash =
        "powers";

    };


  const stats =
    document.getElementById("stats");


  try {

    const d =
      await api("/dashboard");


    stats.innerHTML = `

      <div class="stat card">

        <div class="small">
          ملفات الحفظ
        </div>

        <div class="num">
          ${esc(d.cases ?? 0)}
        </div>

      </div>


      <div class="stat card">

        <div class="small">
          التوكيلات
        </div>

        <div class="num">
          ${esc(d.powers ?? 0)}
        </div>

      </div>


      <div class="stat card">

        <div class="small">
          الحالة
        </div>

        <div
          class="num"
          style="font-size:22px"
        >
          متصلة
        </div>

      </div>

    `;

  } catch (error) {

    stats.innerHTML = `

      <div class="notice">

        ${esc(error.message)}

      </div>

    `;

  }

}


/* ====================================================
   MODAL
==================================================== */

function modal(title, fields, onSave) {

  const m =
    document.createElement("div");


  m.className =
    "modal-back";


  m.innerHTML = `

    <div class="modal card">

      <div class="header">

        <h3>
          ${esc(title)}
        </h3>

        <button
          class="btn secondary"
          id="close"
          type="button"
        >
          إغلاق
        </button>

      </div>


      <form id="mf">

        ${fields.map(
          f => `

            <label>

              ${esc(f.label)}

              <input
                id="${esc(f.id)}"
                value="${esc(f.value || "")}"
                ${f.required === false
                  ? ""
                  : "required"}
              >

            </label>

          `
        ).join("")}


        <button
          class="btn full"
          type="submit"
        >
          حفظ
        </button>


        <div
          id="me"
          class="error"
        ></div>

      </form>

    </div>

  `;


  document.body.appendChild(m);


  m.querySelector("#close").onclick =
    function () {

      m.remove();

    };


  m.querySelector("#mf").onsubmit =
    async function (e) {

      e.preventDefault();


      const values = {};


      fields.forEach(f => {

        const input =
          m.querySelector(
            "#" + f.id
          );


        values[f.id] =
          input.value.trim();

      });


      try {

        await onSave(values);

        m.remove();

      } catch (error) {

        m.querySelector(
          "#me"
        ).textContent =
          error.message;

      }

    };

}


/* ====================================================
   CASES
==================================================== */

async function casesView() {

  if (!token()) {

    return loginView();

  }


  app.innerHTML =
    shell(
      "ملفات الحفظ",
      "إدارة ملفات الحفظ"
    );


  bindCommon();


  const content =
    document.getElementById(
      "content"
    );


  let page = 1;

  let q = "";

  let incomplete = false;


  async function render() {

    content.innerHTML = `

      <div class="toolbar">

        <input
          id="q"
          class="search"
          placeholder="ابحث برقم الملف أو اسم الموكل"
          value="${esc(q)}"
        >


        <button
          class="btn"
          id="search"
        >
          بحث
        </button>


        <button
          class="btn secondary"
          id="inc"
        >
          البيانات الناقصة
        </button>


        <button
          class="btn success"
          id="add"
        >
          + إضافة
        </button>

      </div>


      <div class="notice">

        البيانات مخفية افتراضيًا.
        لن تظهر إلا بعد البحث أو اختيار البيانات الناقصة.

      </div>


      <div id="table"></div>


      <div
        id="pages"
        class="pagination"
      ></div>

    `;


    document.getElementById(
      "search"
    ).onclick =
      function () {

        q =
          document
            .getElementById("q")
            .value
            .trim();


        incomplete =
          false;


        page = 1;


        load();

      };


    document.getElementById(
      "inc"
    ).onclick =
      function () {

        q = "";

        incomplete = true;

        page = 1;

        load();

      };


    document.getElementById(
      "add"
    ).onclick =
      add;


    await load();

  }


  async function load() {

    try {

      const d =
        await api(
          `/cases?q=${encodeURIComponent(q)}&incomplete=${incomplete ? 1 : 0}&page=${page}&limit=50`
        );


      const table =
        document.getElementById(
          "table"
        );


      if (
        !d.data ||
        !Array.isArray(d.data) ||
        !d.data.length
      ) {

        table.innerHTML =
          `
            <div class="notice">
              لا توجد نتائج.
            </div>
          `;

      } else {

        table.innerHTML = `

          <div class="table-wrap">

            <table>

              <thead>

                <tr>

                  <th>
                    رقم الملف
                  </th>

                  <th>
                    اسم الموكل
                  </th>

                  <th>
                    إجراءات
                  </th>

                </tr>

              </thead>


              <tbody>

                ${d.data.map(
                  r => `

                    <tr>

                      <td>
                        ${esc(r.file_number)}
                      </td>

                      <td>
                        ${esc(r.client_name)}
                      </td>

                      <td class="actions">

                        <button
                          class="btn secondary e"
                          data-id="${esc(r.id)}"
                        >
                          تعديل
                        </button>


                        <button
                          class="btn danger d"
                          data-id="${esc(r.id)}"
                        >
                          حذف
                        </button>

                      </td>

                    </tr>

                  `
                ).join("")}

              </tbody>

            </table>

          </div>

        `;

      }


      table
        .querySelectorAll(".e")
        .forEach(button => {

          button.onclick =
            function () {

              const row =
                d.data.find(
                  x =>
                    String(x.id) ===
                    String(
                      button.dataset.id
                    )
                );


              if (row) {

                edit(row);

              }

            };

        });


      table
        .querySelectorAll(".d")
        .forEach(button => {

          button.onclick =
            function () {

              del(
                button.dataset.id
              );

            };

        });


      const pages =
        document.getElementById(
          "pages"
        );


      const p =
        d.pagination || {
          page: 1,
          pages: 1,
          total: 0
        };


      pages.innerHTML = `

        <button
          class="btn secondary"
          id="pr"
          ${p.page <= 1 ? "disabled" : ""}
        >
          السابق
        </button>


        <span>
          صفحة ${p.page} من ${p.pages}
          — ${p.total} سجل
        </span>


        <button
          class="btn secondary"
          id="nx"
          ${p.page >= p.pages ? "disabled" : ""}
        >
          التالي
        </button>

      `;


      document.getElementById(
        "pr"
      ).onclick =
        function () {

          if (page > 1) {

            page--;

            load();

          }

        };


      document.getElementById(
        "nx"
      ).onclick =
        function () {

          if (page < p.pages) {

            page++;

            load();

          }

        };

    } catch (error) {

      const table =
        document.getElementById(
          "table"
        );


      if (table) {

        table.innerHTML = `

          <div class="error">

            ${esc(error.message)}

          </div>

        `;

      }

    }

  }


  async function add() {

    try {

      const last =
        await api(
          "/cases/last-file"
        );


      modal(
        "إضافة ملف حفظ",
        [
          {
            id: "file_number",
            label: "رقم الملف",
            value:
              last.next ??
              last.file_number ??
              ""
          },

          {
            id: "client_name",
            label: "اسم الموكل"
          }
        ],

        async values => {

          await api(
            "/cases",
            {
              method: "POST",

              body:
                JSON.stringify(
                  values
                )
            }
          );


          q =
            values.file_number;


          incomplete =
            false;


          page = 1;


          await load();

        }
      );

    } catch (error) {

      alert(
        error.message
      );

    }

  }


  function edit(row) {

    modal(
      "تعديل ملف الحفظ",
      [
        {
          id: "file_number",
          label: "رقم الملف",
          value:
            row.file_number
        },

        {
          id: "client_name",
          label: "اسم الموكل",
          value:
            row.client_name
        }
      ],

      async values => {

        await api(
          `/cases/${row.id}`,
          {
            method: "PUT",

            body:
              JSON.stringify(
                values
              )
          }
        );


        await load();

      }
    );

  }


  async function del(id) {

    if (
      !confirm(
        "هل تريد حذف هذا الملف؟"
      )
    ) {

      return;

    }


    try {

      await api(
        `/cases/${id}`,
        {
          method: "DELETE"
        }
      );


      await load();

    } catch (error) {

      alert(
        error.message
      );

    }

  }


  await render();

}


/* ====================================================
   POWERS
==================================================== */

async function powersView() {

  if (!token()) {

    return loginView();

  }


  app.innerHTML =
    shell(
      "ملفات التوكيلات",
      "إدارة ملفات التوكيلات"
    );


  bindCommon();


  const content =
    document.getElementById(
      "content"
    );


  let page = 1;

  let q = "";

  let incomplete = false;


  async function render() {

    content.innerHTML = `

      <div class="toolbar">

        <input
          id="q"
          class="search"
          placeholder="رقم الملف أو اسم الموكل أو رقم التوكيل أو جهة التوثيق"
          value="${esc(q)}"
        >


        <button
          class="btn"
          id="search"
        >
          بحث
        </button>


        <button
          class="btn secondary"
          id="inc"
        >
          البيانات الناقصة
        </button>


        <button
          class="btn success"
          id="add"
        >
          + إضافة
        </button>

      </div>


      <div class="notice">

        البيانات مخفية افتراضيًا.
        لن تظهر إلا بعد البحث أو اختيار البيانات الناقصة.

      </div>


      <div id="table"></div>


      <div
        id="pages"
        class="pagination"
      ></div>

    `;


    document.getElementById(
      "search"
    ).onclick =
      function () {

        q =
          document
            .getElementById("q")
            .value
            .trim();


        incomplete =
          false;


        page = 1;


        load();

      };


    document.getElementById(
      "inc"
    ).onclick =
      function () {

        q = "";

        incomplete = true;

        page = 1;

        load();

      };


    document.getElementById(
      "add"
    ).onclick =
      add;


    await load();

  }


  async function load() {

    try {

      const d =
        await api(
          `/powers?q=${encodeURIComponent(q)}&incomplete=${incomplete ? 1 : 0}&page=${page}&limit=50`
        );


      const table =
        document.getElementById(
          "table"
        );


      if (
        !d.data ||
        !Array.isArray(d.data) ||
        !d.data.length
      ) {

        table.innerHTML =
          `
            <div class="notice">
              لا توجد نتائج.
            </div>
          `;

      } else {

        table.innerHTML = `

          <div class="table-wrap">

            <table>

              <thead>

                <tr>

                  <th>
                    رقم الملف
                  </th>

                  <th>
                    اسم الموكل
                  </th>

                  <th>
                    رقم التوكيل
                  </th>

                  <th>
                    جهة التوثيق
                  </th>

                  <th>
                    إجراءات
                  </th>

                </tr>

              </thead>


              <tbody>

                ${d.data.map(
                  r => `

                    <tr>

                      <td>
                        ${esc(r.file_number)}
                      </td>

                      <td>
                        ${esc(r.client_name)}
                      </td>

                      <td>
                        ${esc(r.power_number)}
                      </td>

                      <td>
                        ${esc(
                          r.documentation_authority
                        )}
                      </td>

                      <td class="actions">

                        <button
                          class="btn secondary e"
                          data-id="${esc(r.id)}"
                        >
                          تعديل
                        </button>


                        <button
                          class="btn danger d"
                          data-id="${esc(r.id)}"
                        >
                          حذف
                        </button>

                      </td>

                    </tr>

                  `
                ).join("")}

              </tbody>

            </table>

          </div>

        `;

      }


      table
        .querySelectorAll(".e")
        .forEach(button => {

          button.onclick =
            function () {

              const row =
                d.data.find(
                  x =>
                    String(x.id) ===
                    String(
                      button.dataset.id
                    )
                );


              if (row) {

                edit(row);

              }

            };

        });


      table
        .querySelectorAll(".d")
        .forEach(button => {

          button.onclick =
            function () {

              del(
                button.dataset.id
              );

            };

        });


      const pages =
        document.getElementById(
          "pages"
        );


      const p =
        d.pagination || {
          page: 1,
          pages: 1,
          total: 0
        };


      pages.innerHTML = `

        <button
          class="btn secondary"
          id="pr"
          ${p.page <= 1 ? "disabled" : ""}
        >
          السابق
        </button>


        <span>
          صفحة ${p.page} من ${p.pages}
          — ${p.total} سجل
        </span>


        <button
          class="btn secondary"
          id="nx"
          ${p.page >= p.pages ? "disabled" : ""}
        >
          التالي
        </button>

      `;


      document.getElementById(
        "pr"
      ).onclick =
        function () {

          if (page > 1) {

            page--;

            load();

          }

        };


      document.getElementById(
        "nx"
      ).onclick =
        function () {

          if (page < p.pages) {

            page++;

            load();

          }

        };

    } catch (error) {

      const table =
        document.getElementById(
          "table"
        );


      if (table) {

        table.innerHTML = `

          <div class="error">

            ${esc(error.message)}

          </div>

        `;

      }

    }

  }


  async function add() {

    try {

      const last =
        await api(
          "/powers/last-file"
        );


      modal(
        "إضافة توكيل",

        [
          {
            id: "file_number",
            label: "رقم الملف",
            value:
              last.next ??
              last.file_number ??
              "2432"
          },

          {
            id: "client_name",
            label: "اسم الموكل"
          },

          {
            id: "power_number",
            label: "رقم التوكيل"
          },

          {
            id: "documentation_authority",
            label: "جهة التوثيق"
          }
        ],

        async values => {

          await api(
            "/powers",
            {
              method: "POST",

              body:
                JSON.stringify(
                  values
                )
            }
          );


          q =
            values.power_number;


          incomplete =
            false;


          page = 1;


          await load();

        }
      );

    } catch (error) {

      alert(
        error.message
      );

    }

  }


  function edit(row) {

    modal(
      "تعديل التوكيل",

      [
        {
          id: "file_number",
          label: "رقم الملف",
          value:
            row.file_number
        },

        {
          id: "client_name",
          label: "اسم الموكل",
          value:
            row.client_name
        },

        {
          id: "power_number",
          label: "رقم التوكيل",
          value:
            row.power_number
        },

        {
          id: "documentation_authority",
          label: "جهة التوثيق",
          value:
            row.documentation_authority
        }
      ],

      async values => {

        await api(
          `/powers/${row.id}`,
          {
            method: "PUT",

            body:
              JSON.stringify(
                values
              )
          }
        );


        await load();

      }
    );

  }


  async function del(id) {

    if (
      !confirm(
        "هل تريد حذف هذا التوكيل؟"
      )
    ) {

      return;

    }


    try {

      await api(
        `/powers/${id}`,
        {
          method: "DELETE"
        }
      );


      await load();

    } catch (error) {

      alert(
        error.message
      );

    }

  }


  await render();

}


/* ====================================================
   GENERAL SEARCH
==================================================== */

async function searchView() {

  if (!token()) {

    return loginView();

  }


  app.innerHTML =
    shell(
      "البحث العام",
      "البحث في ملفات الحفظ والتوكيلات"
    );


  bindCommon();


  const content =
    document.getElementById(
      "content"
    );


  content.innerHTML = `

    <div class="toolbar">

      <input
        id="q"
        class="search"
        placeholder="اكتب اسم الموكل أو رقم الملف أو رقم التوكيل"
      >


      <button
        class="btn"
        id="go"
      >
        بحث
      </button>

    </div>


    <div class="notice">

      لن تظهر أي بيانات قبل تنفيذ البحث.

    </div>


    <div id="results"></div>

  `;


  const results =
    document.getElementById(
      "results"
    );


  async function go() {

    const query =
      document
        .getElementById("q")
        .value
        .trim();


    if (!query) {

      results.innerHTML = `

        <div class="notice">

          اكتب اسم الموكل أو رقم الملف أو رقم التوكيل للبحث.

        </div>

      `;

      return;

    }


    results.innerHTML = `

      <div class="notice">
        جاري البحث...
      </div>

    `;


    try {

      const d =
        await api(
          `/search?q=${encodeURIComponent(query)}`
        );


      const cases =
        Array.isArray(d.cases)
          ? d.cases
          : [];


      const powers =
        Array.isArray(d.powers)
          ? d.powers
          : [];


      results.innerHTML = `

        <div class="search-result">

          <h3>
            📁 ملفات الحفظ
            (${cases.length})
          </h3>


          ${
            cases.length

              ? `

                <div class="table-wrap">

                  <table>

                    <thead>

                      <tr>

                        <th>
                          رقم الملف
                        </th>

                        <th>
                          اسم الموكل
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      ${cases.map(
                        r => `

                          <tr>

                            <td>
                              ${esc(
                                r.file_number
                              )}
                            </td>

                            <td>
                              ${esc(
                                r.client_name
                              )}
                            </td>

                          </tr>

                        `
                      ).join("")}

                    </tbody>

                  </table>

                </div>

              `

              : `

                <p class="small">
                  لا توجد ملفات حفظ لهذا البحث.
                </p>

              `
          }

        </div>


        <div class="search-result">

          <h3>
            📜 التوكيلات
            (${powers.length})
          </h3>


          ${
            powers.length

              ? `

                <div class="table-wrap">

                  <table>

                    <thead>

                      <tr>

                        <th>
                          رقم الملف
                        </th>

                        <th>
                          اسم الموكل
                        </th>

                        <th>
                          رقم التوكيل
                        </th>

                        <th>
                          جهة التوثيق
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      ${powers.map(
                        r => `

                          <tr>

                            <td>
                              ${esc(
                                r.file_number
                              )}
                            </td>

                            <td>
                              ${esc(
                                r.client_name
                              )}
                            </td>

                            <td>
                              ${esc(
                                r.power_number
                              )}
                            </td>

                            <td>
                              ${esc(
                                r.documentation_authority
                              )}
                            </td>

                          </tr>

                        `
                      ).join("")}

                    </tbody>

                  </table>

                </div>

              `

              : `

                <p class="small">
                  لا توجد توكيلات لهذا البحث.
                </p>

              `
          }

        </div>

      `;

    } catch (error) {

      console.error(error);


      results.innerHTML = `

        <div class="error">

          ${esc(error.message)}

        </div>

      `;

    }

  }


  document.getElementById(
    "go"
  ).onclick =
    go;


  document.getElementById(
    "q"
  ).onkeydown =
    function (e) {

      if (e.key === "Enter") {

        go();

      }

    };

}


/* ====================================================
   ROUTER
==================================================== */

function route() {

  if (!token()) {

    return loginView();

  }


  const r =
    (location.hash || "")
      .replace("#", "");


  if (r === "cases") {

    casesView();

  }

  else if (r === "powers") {

    powersView();

  }

  else if (r === "search") {

    searchView();

  }

  else {

    dashboard();

  }

}


/* ====================================================
   START
==================================================== */

window.addEventListener(
  "hashchange",
  route
);


route();
