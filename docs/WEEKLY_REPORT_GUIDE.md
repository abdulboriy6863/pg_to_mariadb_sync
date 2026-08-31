# AI Uchun Haftalik Hisobot Yozish Qo'llanmasi va Standart Shablon 📋

Ushbu hujjat **har payshanba kuni rahbariyatga (dasturlashdan xabari bo'lmagan rahbarlar va menejerlarga) beriladigan haftalik hisobotlarni** shakllantirish uchun maxsus yo'riqnomadir.

> [!IMPORTANT]
> **AI AGENTLAR UCHUN KO'RSATMA:**
> Foydalanuvchi sizdan *"Obsidian dagi report qoidasiga qarab hozir qilgan ishimiz bo'yicha hisobot yoz"* deb so'raganda, siz ushbu hujjatdagi qoidalarga 100% amal qilgan holda, dasturchi bo'lmagan inson ham bir o'qishda tushunadigan, biznesga foydasi aniq ko'rsatilgan hisobot tayyorlab berishingiz SHART.

---

## 1. Dasturchi Bo'lmagan Odam Uchun Hisobot Yozish Qoidalari (Core Rules)

1. **Texnik atamalarni hayotiy / biznes tiliga o'giring:**
   * ❌ *Yomon (Juda texnik):* `"safe_float() va regex matching qo'shildi, float(None) Type casting xatosi tuzatildi, TINF_CS bilan JOIN qilindi."`
   * ✅ *Yaxshi (No-tech / Tushunarli):* `"Eski yillardagi (2020-2023) bepul yoki to'lovsiz qolib ketgan cheklardagi ma'lumotlar xatosi to'liq bartaraf etildi. Barcha zaryadlash stansiyalari o'zining haqiqiy manzili va zaryadlovchi ustuniga 100% to'g'ri biriktirildi."`

2. **Har doim 3 ta asosiy savolga javob bering:**
   * **Nima ish qilindi?** (Bajarilgan vazifa)
   * **Nima uchun qilindi va nima muammo hal bo'ldi?** (Biznes sababi)
   * **Qanday aniq natijaga erishildi?** (Raqamlar, foizlar, tejalgan vaqt, xavfsizlik)

3. **Aniq raqamlar va natijalarni ko'rsating (Impact):**
   * Masalan: *"859,892 ta zaryadlash ma'lumotlari 100% to'liq va yo'qotishlarsiz ko'chirishga tayyorlandi."*
   * *"Har kuni tungi 02:00 da inson omilisiz avtomatik yangilanadigan tizim ishga tushirildi."*

4. **Tuzilmani ixcham va ko'zga yoqimli qiling:**
   * Qisqa sarlavhalar, belgilangan ro'yxatlar (bullet points) va emojilardan me'yorida foydalaning.

---

## 2. Standart Haftalik Hisobot Shabloni (Weekly Report Template)

Har bir haftalik hisobot quyidagi 4 ta bo'limdan iborat bo'lishi kerak:

```markdown
# 📑 Haftalik Ish Hisoboti (Sana: YYYY-MM-DD)
**Mas'ul xodim:** Abdulboriy
**Loyiha:** [Loyiha nomi, masalan: PostgreSQL to MariaDB Data Sync & Migration System]

---

### 1. 🎯 Haftaning Asosiy Maqsadi va Biznes Qiymati
* [Bu hafta qilingan ishlar kompaniyaga nima foyda berishi haqida 1-2 gap]

---

### 2. ✅ Bajarilgan Asosiy Ishlar (Oddiy Tilda)
* **[Vazifa 1 Nomi]:** [Nima qilingani va qanday qulaylik yaratilgani]
* **[Vazifa 2 Nomi]:** [Qanday xatolik yoki muammo yechilgani]
* **[Vazifa 3 Nomi]:** [Yaratilgan avtomatlashtirish yoki qulaylik]

---

### 3. 📊 Erishilgan Aniq Natijalar va Raqamlar
* **Ma'lumotlar aniqligi:** [Masalan: 100% (0 ta yo'qotish)]
* **Qamrab olingan davr:** [Masalan: 2020-yildan 2026-yilgacha bo'lgan barcha tarixiy ma'lumotlar]
* **Avtomatlashtirish:** [Masalan: Tungi avtomatik sinxronizatsiya va monitoring paneli faol]

---

### 4. 🔜 Kelgusi Hafta Rejalari
* [Keyingi bosqichda nima qilinishi rejalashtirilgan]
```

---

## 3. Namuna: Hozirgi Tizim Bo'yicha Real Hisobot Misoli

```markdown
# 📑 Haftalik Ish Hisoboti (2026-08-31)
**Mas'ul xodim:** Abdulboriy
**Loyiha:** PostgreSQL dan MariaDB ga Zaryadlash Tarixini Ko'chirish va Kunlik Avtomatik Sinxronizatsiya Tizimi

---

### 1. 🎯 Haftaning Asosiy Maqsadi
Eski serverdagi barcha tarixiy elektromobil zaryadlash seanslari va to'lov hisobotlarini yangi MariaDB tizimiga birorta ham ma'lumot yo'qotmasdan, xavfsiz va avtomatlashtirilgan tarzda o'tkazish.

---

### 2. ✅ Bajarilgan Asosiy Ishlar
1. **Eski Yillardagi Ma'lumotlar Xatoliklari Bartaraf Etildi:**
   * 2020–2023 yillardagi bekor qilingan yoki to'lovsiz zaryadlash seanslaridagi bo'sh qiymatlar sababli to'xtab qolish xatolari to'liq bartaraf qilindi.
2. **Stansiyalar va Zaryadlovchi Qurilmalarni Intellektual Moslashtirish:**
   * Stansiyalar nomlaridagi noaniqliklar (masalan, korxona va pudratchi nomlari ostida yozilgan zaryadlovchilar) to'g'rilanib, ularning har biri yangi tizimdagi o'zining haqiqiy fizik manzili va ustuniga 100% to'g'ri bog'landi.
3. **Kunlik Avtomatik Yangilanish (Batch Sync) Yo'lga Qo'yildi:**
   * Har kuni inson aralashuvisiz, belgilangan vaqtda (tungi 02:00 da) yangi qo'shilgan zaryadlash ma'lumotlarini avtomatik ko'chirib boruvchi xizmat ishga tushirildi.
4. **Veb Boshqaruv Paneli Ishga Tushirildi:**
   * Istalgan vaqtda brauzer orqali tizim holatini kuzatish, sanalar bo'yicha ma'lumotlarni sinovdan o'tkazish (Dry-Run) va hisobotlarni ko'rish imkoniyati yaratildi.

---

### 3. 📊 Erishilgan Aniq Natijalar
* **Jami Qamrab Olingan Ma'lumotlar:** PostgreSQL bazasidagi 859,892 ta zaryadlash yozuvlarining **100% i (barchasi)** yangi bazaga to'g'ri moslashtirildi (0 ta qolib ketgan ma'lumot).
* **Ko'p Yillik Sinov:** 2020-yildan 2026-yilgacha bo'lgan barcha yillar bo'yicha testlar muvaffaqiyatli o'tkazildi.
* **Takrorlanishdan Himoya:** Bir xil ma'lumot qayta yuklanganda dublikat bo'lib ko'payib ketmasligi to'liq ta'minlandi.

---

### 4. 🔜 Kelgusi Hafta Rejalari
* Tizimning kundalik avtomatik ishlashini monitoring qilish va zaryadlash analitikasi bo'yicha qo'shimcha statistik filtrlarni kengaytirish.
```
