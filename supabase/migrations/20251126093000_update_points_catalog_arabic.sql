BEGIN;

UPDATE public.employee_points_log
SET catalog_item_id = NULL
WHERE catalog_item_id IS NOT NULL;

DELETE FROM public.points_catalog;

WITH orgs AS (
  SELECT id AS organization_id FROM public.organizations
),
items AS (
  SELECT 'الغياب بدون إذن (No-Show)'::text AS label, -20::int AS points, 'penalty'::text AS category, true::boolean AS is_active, NULL::text AS description
  UNION ALL SELECT 'تأخير (أكثر من 15 دقيقة)', -4, 'penalty', true, 'يعادل خصم ساعة عمل'
  UNION ALL SELECT 'تأخير (أقل من 15 دقيقة)', -2, 'penalty', true, NULL
  UNION ALL SELECT 'استخدام الموبايل أثناء العمل', -10, 'penalty', true, 'مخالفة جسيمة لسلامة الأطفال'
  UNION ALL SELECT 'مغادرة المنطقة المخصصة بدون إذن', -5, 'penalty', true, NULL
  UNION ALL SELECT 'عدم التبليغ الفوري عن مشكلة (للكابتن/الهوست)', -5, 'penalty', true, NULL
  UNION ALL SELECT 'عدم اتباع التعليمات / الهزار غير اللائق', -5, 'penalty', true, NULL
  UNION ALL SELECT 'التجمعات الجانبية بين الشامبيونز', -3, 'penalty', true, NULL
  UNION ALL SELECT 'مخالفة الزي الرسمي (Uniform)', -3, 'penalty', true, NULL
  UNION ALL SELECT 'ترتيب "بديل" شخصي (بدون علم الـ HR)', -5, 'penalty', true, NULL
  UNION ALL SELECT 'مكافأة الشهر: التزام كامل 100%', 15, 'reward', true, 'صفر غياب / صفر تأخير'
  UNION ALL SELECT 'إنقاذ شيفت (حرج/بديل طوارئ)', 5, 'reward', true, NULL
  UNION ALL SELECT 'تقييم "ممتاز" من ولي أمر (بالاسم)', 5, 'reward', true, NULL
  UNION ALL SELECT 'مكافأة الإغلاق (تسليم المكان مثالياً)', 3, 'reward', true, NULL
  UNION ALL SELECT 'اقتراح نشاط جديد وتنفيذه مع الأطفال', 4, 'reward', true, NULL
  UNION ALL SELECT 'التبليغ المبكر عن صيانة/خطر (Proactive)', 3, 'reward', true, NULL
)
INSERT INTO public.points_catalog (organization_id, label, points, category, is_active, description)
SELECT orgs.organization_id, items.label, items.points, items.category, items.is_active, items.description
FROM orgs CROSS JOIN items;

COMMIT;
