
# ميزان — GitHub Safe Edition

## الفكرة المهمة
ملف البيانات الحقيقي `backend/data/mizan.json` لا يدخل GitHub لأن `.gitignore` يمنعه.
البرنامج ينشئه تلقائيًا عند أول تشغيل ويحفظ البيانات محليًا.

## التشغيل
```bash
npm install
npm start
```
ثم:
`http://localhost:8080`

الدخول:
- username: admin
- password: admin123

## مهم جدًا بخصوص GitHub
GitHub Repository وحده ليس قاعدة بيانات ولا يشغل Node.js. رفع المشروع على GitHub لا يعني أن السيرفر سيعمل من GitHub Pages.

إذا نشرت الـBackend على استضافة، لا تعتمد على Local JSON لحفظ بيانات مكتب حقيقية على استضافة قد تمسح الملفات عند إعادة التشغيل. استخدم قاعدة بيانات دائمة (PostgreSQL مثلًا) مع متغيرات بيئية، ولا تضع بيانات العملاء داخل GitHub.

## حماية البيانات
- `backend/data/mizan.json` موجود في `.gitignore`.
- لا تضع بيانات حقيقية داخل `mizan.json.example`.
- لا ترفع ملفات Excel التي تحتوي بيانات العملاء إلى المستودع.
