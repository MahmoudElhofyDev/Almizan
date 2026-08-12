// =====================================================
// MIZAN - FRONTEND APP
// Login + Dashboard + Cases + Powers + Search
// =====================================================

const app = document.getElementById("app");

// =====================================================
// API
// =====================================================

const API_BASE =
    "https://almizan-production.up.railway.app/api";

// =====================================================
// MEMORY SESSION
// لا localStorage
// لا sessionStorage
// Refresh = Login مرة أخرى
// =====================================================

let tokenValue = "";

// =====================================================
// TOKEN
// =====================================================

function token() {
    return tokenValue;
}

// =====================================================
// CLEAR SESSION
// =====================================================

function clearSession() {

    tokenValue = "";

    try {

        history.replaceState(
            null,
            "",
            window.location.pathname +
            window.location.search
        );

    } catch {

        window.location.hash = "";

    }
}

// =====================================================
// ESCAPE HTML
// =====================================================

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

// =====================================================
// API REQUEST
// =====================================================

async function api(url, options = {}) {

    const headers = {
        ...(options.headers || {})
    };

    const isFormData =
        options.body instanceof FormData;

    if (!isFormData) {

        headers["Content-Type"] =
            "application/json";

    }

    if (token()) {

        headers["Authorization"] =
            "Bearer " + token();

    }

    let response;

    try {

        response = await fetch(
            API_BASE + url,
            {
                ...options,
                headers,
                cache: "no-store"
            }
        );

    } catch (error) {

        console.error(
            "API CONNECTION ERROR:",
            error
        );

        throw new Error(
            "تعذر الاتصال بالسيرفر. تأكد أن Railway يعمل وأن رابط API صحيح."
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

    } catch {

        console.error(
            "INVALID SERVER RESPONSE:",
            text
        );

        throw new Error(
            "السيرفر لم يرجع JSON. تأكد أن Backend يعمل بشكل صحيح."
        );

    }

    if (response.status === 401) {

        clearSession();

        loginView();

        throw new Error(
            data.message ||
            data.error ||
            "انتهت جلسة الدخول. سجل الدخول مرة أخرى."
        );

    }

    if (!response.ok) {

        throw new Error(
            data.message ||
            data.error ||
            `حدث خطأ في السيرفر (${response.status})`
        );

    }

    return data;
}

// =====================================================
// LOGIN VIEW
// =====================================================

function loginView() {

    tokenValue = "";

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
                        type="text"
                        autocomplete="username"
                        placeholder="اسم المستخدم"
                        required
                    >

                    <label>
                        كلمة المرور
                    </label>

                    <input
                        id="password"
                        type="password"
                        autocomplete="current-password"
                        placeholder="كلمة المرور"
                        required
                    >

                    <button
                        class="btn full"
                        id="loginButton"
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
        document.getElementById(
            "loginForm"
        );

    const usernameInput =
        document.getElementById(
            "username"
        );

    const passwordInput =
        document.getElementById(
            "password"
        );

    const loginButton =
        document.getElementById(
            "loginButton"
        );

    const errorBox =
        document.getElementById(
            "loginError"
        );

    form.addEventListener(
        "submit",
        async function (e) {

            e.preventDefault();

            errorBox.textContent = "";

            const username =
                usernameInput.value.trim();

            const password =
                passwordInput.value;

            if (!username) {

                errorBox.textContent =
                    "اكتب اسم المستخدم.";

                usernameInput.focus();

                return;
            }

            if (!password) {

                errorBox.textContent =
                    "اكتب كلمة المرور.";

                passwordInput.focus();

                return;
            }

            loginButton.disabled = true;

            loginButton.textContent =
                "جاري تسجيل الدخول...";

            try {

                console.log(
                    "LOGIN REQUEST:",
                    API_BASE + "/login"
                );

                const response =
                    await fetch(
                        API_BASE + "/login",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Accept":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    username:
                                        username,

                                    password:
                                        password
                                }),

                            cache: "no-store"
                        }
                    );

                const text =
                    await response.text();

                console.log(
                    "LOGIN STATUS:",
                    response.status
                );

                console.log(
                    "LOGIN RESPONSE:",
                    text
                );

                let data = {};

                try {

                    data =
                        text
                            ? JSON.parse(text)
                            : {};

                } catch {

                    throw new Error(
                        "Backend لم يرجع JSON. تأكد من أن مسار /api/login صحيح."
                    );

                }

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        data.error ||
                        `فشل تسجيل الدخول (${response.status})`
                    );

                }

                if (
                    !data.token ||
                    typeof data.token !== "string"
                ) {

                    console.error(
                        "LOGIN RESPONSE WITHOUT TOKEN:",
                        data
                    );

                    throw new Error(
                        "تم الاتصال بالسيرفر ولكن لم يتم استلام Token."
                    );

                }

                // =====================================
                // حفظ الـ Token في الذاكرة فقط
                // =====================================

                tokenValue =
                    data.token;

                console.log(
                    "LOGIN SUCCESS"
                );

                // =====================================
                // تنظيف URL
                // =====================================

                try {

                    history.replaceState(
                        null,
                        "",
                        window.location.pathname +
                        window.location.search
                    );

                } catch {

                    window.location.hash = "";

                }

                // =====================================
                // فتح Dashboard
                // =====================================

                await route();

            } catch (error) {

                console.error(
                    "LOGIN ERROR:",
                    error
                );

                tokenValue = "";

                errorBox.textContent =
                    error.message ||
                    "حدث خطأ أثناء تسجيل الدخول.";

            } finally {

                loginButton.disabled =
                    false;

                loginButton.textContent =
                    "تسجيل الدخول";

            }

        }
    );
}

// =====================================================
// COMMON SHELL
// =====================================================

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
                            type="button"
                        >
                            ↩ العودة للرئيسية
                        </button>

                        <button
                            class="btn danger"
                            id="logout"
                            type="button"
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

// =====================================================
// COMMON BUTTONS
// =====================================================

function bindCommon() {

    const home =
        document.getElementById(
            "home"
        );

    const logout =
        document.getElementById(
            "logout"
        );

    if (home) {

        home.onclick =
            function () {

                window.location.hash = "";

            };

    }

    if (logout) {

        logout.onclick =
            function () {

                clearSession();

                loginView();

            };

    }
}

// =====================================================
// DASHBOARD
// =====================================================

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
                        type="button"
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
                            ابحث عن الموكل أو رقم الملف أو رقم التوكيل.
                        </p>

                        <button
                            class="btn"
                            id="searchPage"
                            type="button"
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
                            type="button"
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
                            type="button"
                        >
                            فتح التوكيلات
                        </button>

                    </div>

                </div>

            </div>

        </div>

    `;

    document.getElementById(
        "logout"
    ).onclick =
        function () {

            clearSession();

            loginView();

        };

    document.getElementById(
        "searchPage"
    ).onclick =
        function () {

            location.hash = "search";

        };

    document.getElementById(
        "casesPage"
    ).onclick =
        function () {

            location.hash = "cases";

        };

    document.getElementById(
        "powersPage"
    ).onclick =
        function () {

            location.hash = "powers";

        };

    const stats =
        document.getElementById(
            "stats"
        );

    try {

        const d =
            await api(
                "/dashboard"
            );

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

// =====================================================
// MODAL
// =====================================================

function modal(
    title,
    fields,
    onSave
) {

    const m =
        document.createElement(
            "div"
        );

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
                                ${
                                    f.required === false
                                        ? ""
                                        : "required"
                                }
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

    document.body.appendChild(
        m
    );

    m.querySelector(
        "#close"
    ).onclick =
        function () {

            m.remove();

        };

    m.querySelector(
        "#mf"
    ).onsubmit =
        async function (e) {

            e.preventDefault();

            const values = {};

            fields.forEach(
                f => {

                    const input =
                        m.querySelector(
                            "#" + f.id
                        );

                    values[f.id] =
                        input.value.trim();

                }
            );

            try {

                await onSave(
                    values
                );

                m.remove();

            } catch (error) {

                m.querySelector(
                    "#me"
                ).textContent =
                    error.message;

            }

        };
}

// =====================================================
// CASES
// =====================================================

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
                    type="button"
                >
                    بحث
                </button>

                <button
                    class="btn secondary"
                    id="inc"
                    type="button"
                >
                    البيانات الناقصة
                </button>

                <button
                    class="btn success"
                    id="add"
                    type="button"
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

                incomplete = false;

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

                table.innerHTML = `

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
                                                    type="button"
                                                >
                                                    تعديل
                                                </button>

                                                <button
                                                    class="btn danger d"
                                                    data-id="${esc(r.id)}"
                                                    type="button"
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

                table
                    .querySelectorAll(".e")
                    .forEach(
                        button => {

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

                        }
                    );

                table
                    .querySelectorAll(".d")
                    .forEach(
                        button => {

                            button.onclick =
                                function () {

                                    del(
                                        button.dataset.id
                                    );

                                };

                        }
                    );

            }

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
                    type="button"
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
                    type="button"
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

                    incomplete = false;

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
                    value: row.file_number
                },
                {
                    id: "client_name",
                    label: "اسم الموكل",
                    value: row.client_name
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

// =====================================================
// POWERS
// =====================================================

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
                    type="button"
                >
                    بحث
                </button>

                <button
                    class="btn secondary"
                    id="inc"
                    type="button"
                >
                    البيانات الناقصة
                </button>

                <button
                    class="btn success"
                    id="add"
                    type="button"
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

                incomplete = false;

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

                table.innerHTML = `

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
                                                ${esc(r.documentation_authority)}
                                            </td>

                                            <td class="actions">

                                                <button
                                                    class="btn secondary e"
                                                    data-id="${esc(r.id)}"
                                                    type="button"
                                                >
                                                    تعديل
                                                </button>

                                                <button
                                                    class="btn danger d"
                                                    data-id="${esc(r.id)}"
                                                    type="button"
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

                table
                    .querySelectorAll(".e")
                    .forEach(
                        button => {

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

                        }
                    );

                table
                    .querySelectorAll(".d")
                    .forEach(
                        button => {

                            button.onclick =
                                function () {

                                    del(
                                        button.dataset.id
                                    );

                                };

                        }
                    );

            }

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
                    type="button"
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
                    type="button"
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

                    incomplete = false;

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
                    value: row.file_number
                },
                {
                    id: "client_name",
                    label: "اسم الموكل",
                    value: row.client_name
                },
                {
                    id: "power_number",
                    label: "رقم التوكيل",
                    value: row.power_number
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

// =====================================================
// GENERAL SEARCH
// =====================================================

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
                type="button"
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
                                                            ${esc(r.file_number)}
                                                        </td>

                                                        <td>
                                                            ${esc(r.client_name)}
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
                                                            ${esc(r.file_number)}
                                                        </td>

                                                        <td>
                                                            ${esc(r.client_name)}
                                                        </td>

                                                        <td>
                                                            ${esc(r.power_number)}
                                                        </td>

                                                        <td>
                                                            ${esc(r.documentation_authority)}
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

            console.error(
                error
            );

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

// =====================================================
// ROUTER
// =====================================================

async function route() {

    if (!token()) {

        loginView();

        return;

    }

    const r =
        (location.hash || "")
            .replace(/^#/, "");

    if (r === "cases") {

        await casesView();

        return;

    }

    if (r === "powers") {

        await powersView();

        return;

    }

    if (r === "search") {

        await searchView();

        return;

    }

    await dashboard();

}

// =====================================================
// BFCACHE
// =====================================================

window.addEventListener(
    "pageshow",
    function (event) {

        if (event.persisted) {

            clearSession();

            loginView();

        }

    }
);

// =====================================================
// HASH CHANGE
// =====================================================

window.addEventListener(
    "hashchange",
    function () {

        route();

    }
);

// =====================================================
// START
// =====================================================

window.addEventListener(
    "load",
    function () {

        // كل Refresh = Login من جديد
        tokenValue = "";

        route();

    }
);
