# PostgreSQL to MariaDB Data Migration & Sync System - Walkthrough & Test Report

Eski serverdagi (PostgreSQL / CSV) quvvatlash tarixi ma'lumotlarini () yangi serverdagi MariaDB () bazasiga ko'chirish va avtomatik sinxronizatsiya tizimi muvaffaqiyatli bajarildi va sinovdan o'tdi!

## Real Ulanish va Ko'chirish Natijalari (Live Import Results)

* **MariaDB Server:**  ( bazasi)
* **Status:** ONLINE (Ulanish va avtorizatsiya muvaffaqiyatli)
* **Baza stansiyalari:** 1,380 ta stansiya va 7,012 ta qurilma ma'lumotlari avtomatik xotiraga olindi.
* **Yuklangan ma'lumotlar:** CSV fayldagi ma'lumotlar MariaDB dagi  jadvaliga real yuklandi.
* **Deduplication (Takrorlanishdan himoya):** Ikkinchi marta ishga tushirilganda barcha 88 ta qator o'tkazib yuborildi ().

---

## MariaDB ga Yuklangan Namuna Ma'lumot (Live Verification Query)



**Natija:**
| transactionId | csId | cpId | begin | end | power (kWh) | totalPrice (WON) | cardNo |
|---|---|---|---|---|---|---|---|
| -100088 | 0 | 20829 | 2026-08-19 22:33:14 | 2026-08-19 23:58:05 | 57.62 | 20,000 | |
| -100087 | 0 | 21191 | 2026-08-19 20:56:59 | 2026-08-19 21:52:41 | 48.05 | 16,740 | 2055222007027925 |
| -100086 | 0 | 21204 | 2026-08-19 19:47:13 | 2026-08-19 21:13:20 | 24.54 | 7,960 | 1010010179595988 |

---

## Loyiha Joylashuvi va Ishlatish

Fayllar joylashuvi: 

1. **CSV tayyor ma'lumotlarni qayta yuklash (yoki yangi CSV larni yuklash):**
   === Executing Live CSV Import ===
Import Result: {'status': 'success', 'inserted': 0, 'duplicates_skipped': 222}

2. **MariaDB ulanishini holatini tekshirish:**
   === Testing MariaDB Connection ===
Status: ONLINE - Connection Successful!
