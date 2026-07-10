-- DESTRUCTIVE DEV SEED for ABH Edu — DO NOT RUN IN PRODUCTION
-- TRUNCATE CASCADE clears users/classes/subjects and related tables, then re-inserts demo data.
-- Объём: классы 15, учителя 75, ученики 255, родители 50.
-- Пароль для всех demo-пользователей: 123456 (один bcrypt hash).
-- Только для локальной разработки / демо (`task dev`).

SET client_min_messages = WARNING;

-- Очистка данных сида: удаляем пользователей, классы и предметы (CASCADE очистит все связанные таблицы)
TRUNCATE users, classes, subjects CASCADE;

-- ========== Классы: 3 базовых + 12 сгенерированных = 15 ==========
INSERT INTO classes (id, name, year_start, grade, letter, shift, shift_locked, max_lessons_per_week, archived)
VALUES
  ('11111111-1111-1111-1111-111111111101'::uuid, '5А', 2026, 5, 'А', 'morning', false, 32, false),
  ('11111111-1111-1111-1111-111111111102'::uuid, '5Б', 2026, 5, 'Б', 'morning', false, 32, false),
  ('11111111-1111-1111-1111-111111111103'::uuid, '9А', 2026, 9, 'А', 'morning', false, 34, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, name, year_start, grade, letter, shift, shift_locked, max_lessons_per_week, archived)
SELECT gen_random_uuid(), (ARRAY['5В','5Г','5Д','6А','6Б','6В','6Г','6Д','9Б','9В','9Г','9Д'])[i],
       2026, (ARRAY[5,5,5,6,6,6,6,6,9,9,9,9])[i], (ARRAY['В','Г','Д','А','Б','В','Г','Д','Б','В','Г','Д'])[i],
       'morning', false, 32, false
FROM generate_series(1, 12) AS i
WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.name = (ARRAY['5В','5Г','5Д','6А','6Б','6В','6Г','6Д','9Б','9В','9Г','9Д'])[i]::text);

-- ========== Предметы (10 шт.) ==========
INSERT INTO subjects (id, name)
VALUES
  ('22222222-2222-2222-2222-222222222201'::uuid, 'Русский язык'),
  ('22222222-2222-2222-2222-222222222202'::uuid, 'Литература'),
  ('22222222-2222-2222-2222-222222222203'::uuid, 'Математика'),
  ('22222222-2222-2222-2222-222222222204'::uuid, 'Информатика'),
  ('22222222-2222-2222-2222-222222222205'::uuid, 'История'),
  ('22222222-2222-2222-2222-222222222206'::uuid, 'Обществознание'),
  ('22222222-2222-2222-2222-222222222207'::uuid, 'Английский язык'),
  ('22222222-2222-2222-2222-222222222208'::uuid, 'Абхазский язык'),
  ('22222222-2222-2222-2222-222222222209'::uuid, 'Биология'),
  ('22222222-2222-2222-2222-222222222210'::uuid, 'Физическая культура')
ON CONFLICT (id) DO NOTHING;

-- ========== Пользователи: admin + 15 учителей ==========
-- bcrypt("123456")
INSERT INTO users (id, email, password_hash, name, role, class_id)
VALUES
  ('33333333-3333-3333-3333-333333333301'::uuid, 'admin@abh-edu.local',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Администратор системы', 'admin', NULL),

  -- 15 Teachers
  ('33333333-3333-3333-3333-333333333310'::uuid, 't.rus.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Камкия Инга Рауфовна', 'teacher', NULL),
  ('33333333-3333-3333-3333-333333333311'::uuid, 't.rus.2@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Гуния Марина Арсеновна', 'teacher', NULL),

  ('33333333-3333-3333-3333-333333333312'::uuid, 't.lit.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Шинкуба Диана Валерьевна', 'teacher', NULL),

  ('33333333-3333-3333-3333-333333333313'::uuid, 't.math.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Гицба Тимур Виталиевич', 'teacher', NULL),
  ('33333333-3333-3333-3333-333333333314'::uuid, 't.math.2@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Агрба Рауф Вадимович', 'teacher', NULL),

  ('33333333-3333-3333-3333-333333333315'::uuid, 't.inf.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Ардзинба Мадина Руслановна', 'teacher', NULL),
  ('33333333-3333-3333-3333-333333333316'::uuid, 't.inf.2@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Дбар Арсен Алексеевич', 'teacher', NULL),

  ('33333333-3333-3333-3333-333333333317'::uuid, 't.hist.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Агрба Аслан Шамильевич', 'teacher', NULL),

  ('33333333-3333-3333-3333-333333333318'::uuid, 't.soc.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Логуа Инал Георгиевич', 'teacher', NULL),

  ('33333333-3333-3333-3333-333333333319'::uuid, 't.eng.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Лакоба Диана Сергеевна', 'teacher', NULL),
  ('33333333-3333-3333-3333-33333333331a'::uuid, 't.eng.2@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Кварчия Ника Георгиевна', 'teacher', NULL),

  ('33333333-3333-3333-3333-33333333331b'::uuid, 't.abh.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Барцыц Инал Нодарович', 'teacher', NULL),

  ('33333333-3333-3333-3333-33333333331c'::uuid, 't.bio.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Зантария Карина Руслановна', 'teacher', NULL),

  ('33333333-3333-3333-3333-33333333331d'::uuid, 't.pe.1@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Тарба Саид Саидович', 'teacher', NULL),

  ('33333333-3333-3333-3333-33333333331e'::uuid, 't.reserve@school.abh',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Кецба Милана Тимуровна', 'teacher', NULL)
ON CONFLICT (id) DO NOTHING;

-- Ещё 60 учителей (всего 75): генерация через generate_series
INSERT INTO users (id, email, password_hash, name, role, class_id)
SELECT gen_random_uuid(), 't.gen.' || n || '@school.abh',
       '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u',
       'Учитель ' || n, 'teacher', NULL
FROM generate_series(1, 60) AS n
ON CONFLICT (email) DO NOTHING;

-- ========== Учителя -> предметы (teacher_subjects) ==========
-- Дубли по teacher_id+subject_id не вставляем.
INSERT INTO teacher_subjects (id, teacher_id, subject_id)
SELECT gen_random_uuid(), t.id, s.id
FROM users t
JOIN subjects s ON (
  (t.email='t.rus.1@school.abh' AND s.name IN ('Русский язык')) OR
  (t.email='t.rus.2@school.abh' AND s.name IN ('Русский язык')) OR
  (t.email='t.lit.1@school.abh' AND s.name IN ('Литература')) OR
  (t.email='t.math.1@school.abh' AND s.name IN ('Математика')) OR
  (t.email='t.math.2@school.abh' AND s.name IN ('Математика')) OR
  (t.email='t.inf.1@school.abh' AND s.name IN ('Информатика')) OR
  (t.email='t.inf.2@school.abh' AND s.name IN ('Информатика')) OR
  (t.email='t.hist.1@school.abh' AND s.name IN ('История')) OR
  (t.email='t.soc.1@school.abh' AND s.name IN ('Обществознание')) OR
  (t.email='t.eng.1@school.abh' AND s.name IN ('Английский язык')) OR
  (t.email='t.eng.2@school.abh' AND s.name IN ('Английский язык')) OR
  (t.email='t.abh.1@school.abh' AND s.name IN ('Абхазский язык')) OR
  (t.email='t.bio.1@school.abh' AND s.name IN ('Биология')) OR
  (t.email='t.pe.1@school.abh' AND s.name IN ('Физическая культура')) OR
  (t.email='t.reserve@school.abh' AND s.name IN ('Русский язык','Математика','Английский язык')) -- резерв
)
WHERE t.role='teacher'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_subjects ts
    WHERE ts.teacher_id=t.id AND ts.subject_id=s.id
  );

-- Учителя t.gen.* -> по одному предмету (цикл по 10 предметам)
INSERT INTO teacher_subjects (id, teacher_id, subject_id)
SELECT gen_random_uuid(), te.id, su.id
FROM (SELECT id, (row_number() OVER (ORDER BY email) - 1) % 10 AS subj_idx FROM users WHERE role = 'teacher' AND email LIKE 't.gen.%') te
JOIN (SELECT id, (row_number() OVER (ORDER BY name) - 1)::int AS idx FROM subjects) su ON su.idx = te.subj_idx
WHERE NOT EXISTS (SELECT 1 FROM teacher_subjects ts WHERE ts.teacher_id = te.id AND ts.subject_id = su.id);

-- ========== Учителя -> классы (teacher_classes) ==========
-- Базовые привязки для первых 3 классов + для всех 15 классов по 10 учителей (round-robin 75)
INSERT INTO teacher_classes (id, teacher_id, class_id)
SELECT gen_random_uuid(), t.id, c.id
FROM users t
JOIN classes c ON c.id IN (
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111102'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid
)
WHERE t.role='teacher'
  AND (
    (t.email IN ('t.rus.1@school.abh','t.math.1@school.abh','t.eng.1@school.abh','t.inf.1@school.abh','t.abh.1@school.abh','t.pe.1@school.abh','t.lit.1@school.abh','t.bio.1@school.abh','t.hist.1@school.abh','t.soc.1@school.abh') AND c.name='5А')
    OR (t.email IN ('t.rus.2@school.abh','t.math.2@school.abh','t.eng.2@school.abh','t.inf.2@school.abh','t.abh.1@school.abh','t.pe.1@school.abh','t.lit.1@school.abh','t.bio.1@school.abh','t.hist.1@school.abh','t.soc.1@school.abh') AND c.name='5Б')
    OR (t.email IN ('t.rus.1@school.abh','t.math.1@school.abh','t.eng.1@school.abh','t.inf.1@school.abh','t.hist.1@school.abh','t.soc.1@school.abh','t.bio.1@school.abh','t.pe.1@school.abh','t.abh.1@school.abh') AND c.name='9А')
  )
  AND NOT EXISTS (SELECT 1 FROM teacher_classes tc WHERE tc.teacher_id=t.id AND tc.class_id=c.id);

-- Остальные 12 классов: каждому классу по 10 учителей (из 75 по порядку)
WITH classes_ord AS (SELECT id, name, (row_number() OVER (ORDER BY name) - 1) AS rn FROM classes WHERE name NOT IN ('5А','5Б','9А')),
     teachers_ord AS (SELECT id, (row_number() OVER (ORDER BY email) - 1) AS rn FROM users WHERE role = 'teacher'),
     need AS (SELECT c.id AS class_id, c.rn AS class_rn, (c.rn * 10 + s.rn) % 75 AS teacher_rn
              FROM classes_ord c CROSS JOIN (SELECT (row_number() OVER (ORDER BY name) - 1)::int AS rn FROM subjects) s)
INSERT INTO teacher_classes (id, teacher_id, class_id)
SELECT gen_random_uuid(), t.id, n.class_id
FROM need n
JOIN teachers_ord t ON t.rn = n.teacher_rn
WHERE NOT EXISTS (SELECT 1 FROM teacher_classes tc WHERE tc.teacher_id = t.id AND tc.class_id = n.class_id);

-- ========== class_subjects: назначение учителя на предмет в классе ==========
-- Важно: (class_id, subject_id) уникально. Распределяем так, чтобы предметы в классе были "широкие".
-- 5А
INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
VALUES
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222201'::uuid,(SELECT id FROM users WHERE email='t.rus.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222202'::uuid,(SELECT id FROM users WHERE email='t.lit.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222203'::uuid,(SELECT id FROM users WHERE email='t.math.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222204'::uuid,(SELECT id FROM users WHERE email='t.inf.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222207'::uuid,(SELECT id FROM users WHERE email='t.eng.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222208'::uuid,(SELECT id FROM users WHERE email='t.abh.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222209'::uuid,(SELECT id FROM users WHERE email='t.bio.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222205'::uuid,(SELECT id FROM users WHERE email='t.hist.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222206'::uuid,(SELECT id FROM users WHERE email='t.soc.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111101'::uuid,'22222222-2222-2222-2222-222222222210'::uuid,(SELECT id FROM users WHERE email='t.pe.1@school.abh'))
ON CONFLICT DO NOTHING;

-- 5Б
INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
VALUES
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222201'::uuid,(SELECT id FROM users WHERE email='t.rus.2@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222202'::uuid,(SELECT id FROM users WHERE email='t.lit.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222203'::uuid,(SELECT id FROM users WHERE email='t.math.2@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222204'::uuid,(SELECT id FROM users WHERE email='t.inf.2@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222207'::uuid,(SELECT id FROM users WHERE email='t.eng.2@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222208'::uuid,(SELECT id FROM users WHERE email='t.abh.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222209'::uuid,(SELECT id FROM users WHERE email='t.bio.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222205'::uuid,(SELECT id FROM users WHERE email='t.hist.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222206'::uuid,(SELECT id FROM users WHERE email='t.soc.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111102'::uuid,'22222222-2222-2222-2222-222222222210'::uuid,(SELECT id FROM users WHERE email='t.pe.1@school.abh'))
ON CONFLICT DO NOTHING;

-- 9А
INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
VALUES
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222201'::uuid,(SELECT id FROM users WHERE email='t.rus.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222203'::uuid,(SELECT id FROM users WHERE email='t.math.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222204'::uuid,(SELECT id FROM users WHERE email='t.inf.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222205'::uuid,(SELECT id FROM users WHERE email='t.hist.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222206'::uuid,(SELECT id FROM users WHERE email='t.soc.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222207'::uuid,(SELECT id FROM users WHERE email='t.eng.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222209'::uuid,(SELECT id FROM users WHERE email='t.bio.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222210'::uuid,(SELECT id FROM users WHERE email='t.pe.1@school.abh')),
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111103'::uuid,'22222222-2222-2222-2222-222222222208'::uuid,(SELECT id FROM users WHERE email='t.abh.1@school.abh'))
ON CONFLICT DO NOTHING;

-- class_subjects для остальных 12 классов: по 10 предметов, учитель round-robin из 75
WITH cls AS (
  SELECT id, (row_number() OVER (ORDER BY name) - 1) AS rn
  FROM classes WHERE name NOT IN ('5А','5Б','9А')
),
subj AS (SELECT id, (row_number() OVER (ORDER BY name) - 1)::int AS rn FROM subjects),
tch AS (SELECT id, (row_number() OVER (ORDER BY email) - 1) AS rn FROM users WHERE role = 'teacher')
INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
SELECT gen_random_uuid(), cls.id, subj.id, tch.id
FROM cls CROSS JOIN subj
JOIN tch ON tch.rn = (cls.rn * 10 + subj.rn) % 75
ON CONFLICT DO NOTHING;

-- ========== Ученики: база 51 × 5 копий = 255, распределение по 15 классам ==========
WITH roster AS (
  SELECT * FROM (VALUES
    ('s.5a.01@school.abh','Шамба Астамур Рамазанович','5А'),('s.5a.02@school.abh','Лакоба Саида Раульевна','5А'),('s.5a.03@school.abh','Кварчия Давид Русланович','5А'),('s.5a.04@school.abh','Ардзинба Алина Тимуровна','5А'),('s.5a.05@school.abh','Агрба Рауф Вадимович','5А'),('s.5a.06@school.abh','Дбар София Алексеевна','5А'),('s.5a.07@school.abh','Чачба Амра Виталиевна','5А'),('s.5a.08@school.abh','Гицба Леван Аркадьевич','5А'),('s.5a.09@school.abh','Багателия Артур Игоревич','5А'),('s.5a.10@school.abh','Куприянова Елена Михайловна','5А'),('s.5a.11@school.abh','Гуния Даниэль Арсенович','5А'),('s.5a.12@school.abh','Зантария Карина Руслановна','5А'),('s.5a.13@school.abh','Логуа Инал Георгиевич','5А'),('s.5a.14@school.abh','Пилия Сабина Рашидовна','5А'),('s.5a.15@school.abh','Эшба Алан Нодарович','5А'),('s.5a.16@school.abh','Кецба Милана Тимуровна','5А'),('s.5a.17@school.abh','Хагба Роберт Вячеславович','5А'),('s.5a.18@school.abh','Шинкуба Диана Валерьевна','5А'),
    ('s.5b.01@school.abh','Гицба Амина Витальевна','5Б'),('s.5b.02@school.abh','Агрба Тимур Рауфович','5Б'),('s.5b.03@school.abh','Ардзинба Тимофей Русланович','5Б'),('s.5b.04@school.abh','Шамба Мариам Зауровна','5Б'),('s.5b.05@school.abh','Кварчия Ника Георгиевна','5Б'),('s.5b.06@school.abh','Дбар Тимур Алексеевич','5Б'),('s.5b.07@school.abh','Лакоба Артём Сергеевич','5Б'),('s.5b.08@school.abh','Чачба Саида Раульевна','5Б'),('s.5b.09@school.abh','Шинкуба Алиса Валерьевна','5Б'),('s.5b.10@school.abh','Эшба Амир Нодарович','5Б'),('s.5b.11@school.abh','Гуния Мария Арсеновна','5Б'),('s.5b.12@school.abh','Зантария Давид Русланович','5Б'),('s.5b.13@school.abh','Пилия Алан Рашидович','5Б'),('s.5b.14@school.abh','Логуа София Георгиевна','5Б'),('s.5b.15@school.abh','Кецба Роберт Тимурович','5Б'),('s.5b.16@school.abh','Хагба Милана Вячеславовна','5Б'),('s.5b.17@school.abh','Багателия Георгий Игоревич','5Б'),
    ('s.9a.01@school.abh','Багателия Артур Игоревич','9А'),('s.9a.02@school.abh','Кварчия Артур Русланович','9А'),('s.9a.03@school.abh','Ардзинба Элина Тимуровна','9А'),('s.9a.04@school.abh','Лакоба Диана Раульевна','9А'),('s.9a.05@school.abh','Шамба Заур Рамазанович','9А'),('s.9a.06@school.abh','Агрба Мадина Вадимовна','9А'),('s.9a.07@school.abh','Дбар Арсен Алексеевич','9А'),('s.9a.08@school.abh','Чачба Алина Виталиевна','9А'),('s.9a.09@school.abh','Эшба Тимур Нодарович','9А'),('s.9a.10@school.abh','Шинкуба Роберт Валерьевич','9А'),('s.9a.11@school.abh','Логуа Сабина Георгиевна','9А'),('s.9a.12@school.abh','Гуния Тимур Арсенович','9А'),('s.9a.13@school.abh','Зантария Мариам Руслановна','9А'),('s.9a.14@school.abh','Пилия Рауф Рашидович','9А'),('s.9a.15@school.abh','Кецба Алиса Тимуровна','9А'),('s.9a.16@school.abh','Хагба Давид Вячеславович','9А')
  ) AS t(email, name, base_class)
),
-- Копии 1..5: новый класс 5А→5А,5Б,5В,5Г,5Д; 5Б→5Б,5В,5Г,5Д,6А; 9А→9А,9Б,9В,9Г,9Д
class_map AS (
  SELECT unnest(ARRAY['5А','5Б','5В','5Г','5Д','5Б','5В','5Г','5Д','6А','9А','9Б','9В','9Г','9Д']) AS new_class,
         unnest(ARRAY[1,1,1,1,1,2,2,2,2,2,3,3,3,3,3]) AS base_idx,
         unnest(ARRAY[1,2,3,4,5,1,2,3,4,5,1,2,3,4,5]) AS copy
),
expanded AS (
  SELECT replace(r.email, '@', '.c' || g.n || '@') AS email, r.name || ' ' || g.n AS name,
         (SELECT id FROM classes c WHERE c.name = cm.new_class LIMIT 1) AS class_id
  FROM roster r
  JOIN (SELECT generate_series(1, 5) AS n) g ON true
  JOIN class_map cm ON cm.base_idx = (CASE r.base_class WHEN '5А' THEN 1 WHEN '5Б' THEN 2 WHEN '9А' THEN 3 END) AND cm.copy = g.n
)
INSERT INTO users (id, email, password_hash, name, role, class_id)
SELECT gen_random_uuid(), expanded.email, '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', expanded.name, 'student', expanded.class_id
FROM expanded
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, class_id = EXCLUDED.class_id
WHERE users.role = 'student';

-- ========== students table ==========
INSERT INTO students (id, user_id, class_id, name, class_name)
SELECT gen_random_uuid(), u.id, u.class_id, u.name, c.name
FROM users u
JOIN classes c ON c.id = u.class_id
WHERE u.role='student'
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id=u.id);

RESET client_min_messages;


-- ===== Расписание для всех 15 классов (план генерируется через SQL) =====
WITH target_classes AS (SELECT id FROM classes),
del AS (DELETE FROM schedule_slots ss WHERE ss.class_id IN (SELECT id FROM target_classes) RETURNING 1),
times_arr AS (
  SELECT * FROM (VALUES (1,'08:30'::varchar(10)),(2,'09:25'),(3,'10:20'),(4,'11:30'),(5,'12:25'),(6,'13:20')) AS t(lesson_number, time)
),
days AS (
  SELECT unnest(ARRAY['Понедельник','Вторник','Среда','Четверг','Пятница']) AS day_label,
         unnest(ARRAY[0,1,2,3,4]) AS day_idx
),
lesson_nums AS (SELECT generate_series(1, 6) AS lesson_number),
allowed_slots AS (
  SELECT d.day_label, d.day_idx, n.lesson_number
  FROM days d
  JOIN lesson_nums n ON (
    (d.day_label IN ('Понедельник','Вторник','Среда') AND n.lesson_number BETWEEN 1 AND 6) OR
    (d.day_label = 'Четверг' AND n.lesson_number BETWEEN 1 AND 5) OR
    (d.day_label = 'Пятница' AND n.lesson_number BETWEEN 1 AND 4)
  )
),
class_names AS (
  SELECT unnest(ARRAY['5А','5Б','5В','5Г','5Д','6А','6Б','6В','6Г','6Д','9А','9Б','9В','9Г','9Д']) AS class_name,
         generate_series(0, 14) AS class_idx
),
subj_names AS (
  SELECT unnest(ARRAY['Русский язык','Литература','Математика','Информатика','История','Обществознание','Английский язык','Абхазский язык','Биология','Физическая культура']) AS subject_name,
         generate_series(0, 9) AS subj_idx
),
plan AS (
  SELECT a.day_label, a.lesson_number, c.class_name,
         (SELECT subject_name FROM subj_names sn WHERE sn.subj_idx = (a.day_idx + a.lesson_number + c.class_idx) % 10 LIMIT 1) AS subject_name
  FROM allowed_slots a
  CROSS JOIN class_names c
),
resolved AS (
  SELECT
    gen_random_uuid() AS id,
    c.id AS class_id,
    s.id AS subject_id,
    u.id AS teacher_id,
    p.day_label,
    p.lesson_number,
    t.time,
    c.shift,
    u.name AS teacher_name,
    CASE
      WHEN p.lesson_number IN (1,2) THEN '101'
      WHEN p.lesson_number IN (3,4) THEN '203'
      ELSE '312'
    END AS room,
    NULL::varchar(255) AS note,
    false AS is_cancelled
  FROM plan p
  JOIN classes c ON c.name = p.class_name
  JOIN subjects s ON s.name = p.subject_name
  JOIN class_subjects cs ON cs.class_id = c.id AND cs.subject_id = s.id
  JOIN users u ON u.id = cs.teacher_id
  JOIN times_arr t ON t.lesson_number = p.lesson_number
)

INSERT INTO schedule_slots (id, class_id, subject_id, teacher_id, day_label, lesson_number, time, shift, teacher_name, room, note, is_cancelled)
SELECT id, class_id, subject_id, teacher_id, day_label, lesson_number, time, shift, teacher_name, room, note, is_cancelled FROM resolved;

-- Демо-классы: гарантируем слот расписания для каждой пары (класс, предмет) из class_subjects.
-- Без этого часть предметов (напр. «Русский язык» в 5А) не попадает в plan из-за формулы (day+lesson+class) % 10.
WITH times_arr AS (
  SELECT * FROM (VALUES (1,'08:30'::varchar(10)),(2,'09:25'),(3,'10:20'),(4,'11:30'),(5,'12:25'),(6,'13:20')) AS t(lesson_number, time)
),
days AS (
  SELECT unnest(ARRAY['Понедельник','Вторник','Среда','Четверг','Пятница']) AS day_label,
         unnest(ARRAY[0,1,2,3,4]) AS day_idx
),
lesson_nums AS (SELECT generate_series(1, 6) AS lesson_number),
allowed_slots AS (
  SELECT d.day_label, d.day_idx, n.lesson_number
  FROM days d
  JOIN lesson_nums n ON (
    (d.day_label IN ('Понедельник','Вторник','Среда') AND n.lesson_number BETWEEN 1 AND 6) OR
    (d.day_label = 'Четверг' AND n.lesson_number BETWEEN 1 AND 5) OR
    (d.day_label = 'Пятница' AND n.lesson_number BETWEEN 1 AND 4)
  )
),
demo_class_ids AS (
  SELECT id FROM classes WHERE name IN ('5А', '5Б', '9А')
),
missing_cs AS (
  SELECT
    cs.class_id,
    cs.subject_id,
    cs.teacher_id,
    c.shift,
    u.name AS teacher_name,
    row_number() OVER (PARTITION BY cs.class_id ORDER BY s.name) AS subj_rn
  FROM class_subjects cs
  JOIN demo_class_ids dc ON dc.id = cs.class_id
  JOIN classes c ON c.id = cs.class_id
  JOIN users u ON u.id = cs.teacher_id
  JOIN subjects s ON s.id = cs.subject_id
  WHERE NOT EXISTS (
    SELECT 1 FROM schedule_slots ss
    WHERE ss.class_id = cs.class_id AND ss.subject_id = cs.subject_id
  )
),
slot_candidates AS (
  SELECT
    m.class_id,
    m.subject_id,
    m.teacher_id,
    m.shift,
    m.teacher_name,
    d.day_label,
    ln.lesson_number,
    t.time,
    row_number() OVER (
      PARTITION BY m.class_id, m.subject_id
      ORDER BY d.day_idx, ln.lesson_number
    ) AS pick_rn
  FROM missing_cs m
  CROSS JOIN days d
  CROSS JOIN lesson_nums ln
  JOIN allowed_slots a ON a.day_label = d.day_label AND a.lesson_number = ln.lesson_number
  JOIN times_arr t ON t.lesson_number = ln.lesson_number
  WHERE NOT EXISTS (
    SELECT 1 FROM schedule_slots ss
    WHERE ss.class_id = m.class_id
      AND ss.day_label = d.day_label
      AND ss.lesson_number = ln.lesson_number
  )
)
INSERT INTO schedule_slots (id, class_id, subject_id, teacher_id, day_label, lesson_number, time, shift, teacher_name, room, note, is_cancelled)
SELECT
  gen_random_uuid(),
  class_id,
  subject_id,
  teacher_id,
  day_label,
  lesson_number,
  time,
  shift,
  teacher_name,
  '101',
  NULL,
  false
FROM slot_candidates
WHERE pick_rn = 1;

-- Demo schedule patch: в демо-классах заменяем один слот, если предмет из class_subjects не попал в расписание.
WITH times_arr AS (
  SELECT * FROM (VALUES (1,'08:30'::varchar(10)),(2,'09:25'),(3,'10:20'),(4,'11:30'),(5,'12:25'),(6,'13:20')) AS t(lesson_number, time)
),
patches AS (
  SELECT * FROM (VALUES
    ('5А', 'Русский язык', 'Понедельник', 1, 't.rus.1@school.abh'),
    ('5А', 'Физическая культура', 'Пятница', 4, 't.pe.1@school.abh'),
    ('5Б', 'Русский язык', 'Вторник', 1, 't.rus.2@school.abh'),
    ('9А', 'Русский язык', 'Среда', 1, 't.rus.1@school.abh')
  ) AS t(class_name, subject_name, day_label, lesson_number, teacher_email)
),
resolved AS (
  SELECT
    c.id AS class_id,
    s.id AS subject_id,
    u.id AS teacher_id,
    p.day_label,
    p.lesson_number,
    t.time,
    c.shift,
    u.name AS teacher_name
  FROM patches p
  JOIN classes c ON c.name = p.class_name
  JOIN subjects s ON s.name = p.subject_name
  JOIN users u ON u.email = p.teacher_email
  JOIN times_arr t ON t.lesson_number = p.lesson_number
  WHERE EXISTS (
    SELECT 1 FROM class_subjects cs
    WHERE cs.class_id = c.id AND cs.subject_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM schedule_slots ss
    WHERE ss.class_id = c.id AND ss.subject_id = s.id
  )
),
cleared AS (
  DELETE FROM schedule_slots ss
  USING resolved r
  WHERE ss.class_id = r.class_id
    AND ss.day_label = r.day_label
    AND ss.lesson_number = r.lesson_number
  RETURNING 1
)
INSERT INTO schedule_slots (id, class_id, subject_id, teacher_id, day_label, lesson_number, time, shift, teacher_name, room, note, is_cancelled)
SELECT gen_random_uuid(), class_id, subject_id, teacher_id, day_label, lesson_number, time, shift, teacher_name, '101', NULL, false
FROM resolved;

-- ========== Lessons (даты за 1 семестр 2026-2026 для столбцов журнала и оценок) ==========
-- Семестр 1: 2026-09-01 .. 2026-01-31. Создаём уроки на несколько дат по каждому (class, subject).
WITH lesson_dates AS (
  SELECT * FROM (VALUES
    ('2026-09-15'::date),
    ('2026-10-10'::date),
    ('2026-11-20'::date),
    ('2026-12-15'::date),
    ('2026-01-20'::date)
  ) AS t(d)
),
class_subj AS (
  SELECT DISTINCT class_id, subject_id,
         (SELECT time FROM schedule_slots ss2 WHERE ss2.class_id = ss.class_id AND ss2.subject_id = ss.subject_id LIMIT 1) AS time,
         (SELECT room FROM schedule_slots ss2 WHERE ss2.class_id = ss.class_id AND ss2.subject_id = ss.subject_id LIMIT 1) AS room
  FROM schedule_slots ss
)
INSERT INTO lessons (id, class_id, subject_id, date, time, room)
SELECT gen_random_uuid(), cs.class_id, cs.subject_id, ld.d, COALESCE(cs.time, '08:30'), COALESCE(cs.room, '101')
FROM class_subj cs
CROSS JOIN lesson_dates ld
WHERE NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id = cs.class_id AND l.subject_id = cs.subject_id AND l.date = ld.d);

-- ========== Grades: много оценок по всем предметам для всех учеников всех классов ==========
-- Семестр 1: 2026-09-01 .. 2026-01-31. По 25 оценок на каждую пару (ученик, предмет класса).
WITH class_subjects_distinct AS (
  SELECT DISTINCT class_id, subject_id FROM schedule_slots
),
students_with_class AS (
  SELECT id AS student_id, class_id FROM users WHERE role = 'student' AND class_id IS NOT NULL
),
pairs_s1 AS (
  SELECT swc.student_id, csd.subject_id
  FROM students_with_class swc
  JOIN class_subjects_distinct csd ON csd.class_id = swc.class_id
),
grades_s1 AS (
  SELECT
    p.student_id,
    p.subject_id,
    '2026-09-01'::date + (g.n * 6) AS grade_date,
    (ARRAY['2','3','4','5'])[1 + (abs(hashtext(p.student_id::text || p.subject_id::text || g.n::text)) % 4)]::text AS value
  FROM pairs_s1 p
  CROSS JOIN generate_series(0, 24) AS g(n)
  WHERE '2026-09-01'::date + (g.n * 6) <= '2026-01-31'::date
)
INSERT INTO grades (id, student_id, subject_id, date, value)
SELECT gen_random_uuid(), student_id, subject_id, grade_date, value FROM grades_s1;

-- Семестр 2: 2026-02-01 .. 2026-06-30. По 25 оценок на каждую пару (ученик, предмет класса).
WITH class_subjects_distinct AS (
  SELECT DISTINCT class_id, subject_id FROM schedule_slots
),
students_with_class AS (
  SELECT id AS student_id, class_id FROM users WHERE role = 'student' AND class_id IS NOT NULL
),
pairs_s2 AS (
  SELECT swc.student_id, csd.subject_id
  FROM students_with_class swc
  JOIN class_subjects_distinct csd ON csd.class_id = swc.class_id
),
grades_s2 AS (
  SELECT
    p.student_id,
    p.subject_id,
    '2026-02-01'::date + (g.n * 6) AS grade_date,
    (ARRAY['2','3','4','5'])[1 + (abs(hashtext(p.student_id::text || p.subject_id::text || g.n::text)) % 4)]::text AS value
  FROM pairs_s2 p
  CROSS JOIN generate_series(0, 24) AS g(n)
  WHERE '2026-02-01'::date + (g.n * 6) <= '2026-06-30'::date
)
INSERT INTO grades (id, student_id, subject_id, date, value)
SELECT gen_random_uuid(), student_id, subject_id, grade_date, value FROM grades_s2;

-- Демо-оценки в текущем 14-дневном окне журнала (относительно CURRENT_DATE).
WITH demo_class AS (
  SELECT '11111111-1111-1111-1111-111111111101'::uuid AS class_id
),
demo_dates AS (
  SELECT d::date AS grade_date
  FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS d
  WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
),
demo_students AS (
  SELECT u.id AS student_id
  FROM users u
  CROSS JOIN demo_class dc
  WHERE u.role = 'student' AND u.class_id = dc.class_id
),
demo_subjects AS (
  SELECT id AS subject_id
  FROM subjects
  WHERE name IN ('Русский язык', 'Литература', 'Математика')
)
INSERT INTO grades (id, student_id, subject_id, date, value)
SELECT
  gen_random_uuid(),
  ds.student_id,
  sub.subject_id,
  dd.grade_date,
  (ARRAY['3', '4', '5'])[1 + (abs(hashtext(ds.student_id::text || sub.subject_id::text || dd.grade_date::text)) % 3)]
FROM demo_students ds
CROSS JOIN demo_subjects sub
CROSS JOIN demo_dates dd
WHERE NOT EXISTS (
  SELECT 1 FROM grades g
  WHERE g.student_id = ds.student_id
    AND g.subject_id = sub.subject_id
    AND g.date = dd.grade_date
);

-- ========== Homework: на сегодня и неделю по предметам для всех классов ==========
WITH classes_subjects AS (
  SELECT DISTINCT class_id, subject_id FROM schedule_slots
),
hw_dates AS (
  SELECT (CURRENT_DATE + (n || ' days')::interval)::date AS due_date
  FROM generate_series(0, 7) AS n
)
INSERT INTO homework (id, class_id, subject_id, due_date, text)
SELECT gen_random_uuid(), cs.class_id, cs.subject_id, hw_dates.due_date,
       'ДЗ на ' || to_char(hw_dates.due_date, 'DD.MM') || ' (демо)'
FROM classes_subjects cs
CROSS JOIN hw_dates;

-- ========== Родители: 10 вручную + 40 через generate_series = 50 ==========
INSERT INTO users (id, email, password_hash, name, role, class_id)
VALUES
  (gen_random_uuid(), 'parent01@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Один', 'parent', NULL),
  (gen_random_uuid(), 'parent02@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Два', 'parent', NULL),
  (gen_random_uuid(), 'parent03@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Три', 'parent', NULL),
  (gen_random_uuid(), 'parent04@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Четыре', 'parent', NULL),
  (gen_random_uuid(), 'parent05@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Пять', 'parent', NULL),
  (gen_random_uuid(), 'parent06@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Шесть', 'parent', NULL),
  (gen_random_uuid(), 'parent07@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Семь', 'parent', NULL),
  (gen_random_uuid(), 'parent08@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Восемь', 'parent', NULL),
  (gen_random_uuid(), 'parent09@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Девять', 'parent', NULL),
  (gen_random_uuid(), 'parent10@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель Десять', 'parent', NULL)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, email, password_hash, name, role, class_id)
SELECT gen_random_uuid(), 'parent.' || n || '@school.abh', '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель ' || n, 'parent', NULL
FROM generate_series(11, 50) AS n
ON CONFLICT (email) DO NOTHING;

-- Связи parent_children: каждому из 50 родителей по 2 ребёнка (из 255 учеников, round-robin)
WITH parents AS (
  SELECT id, row_number() OVER (ORDER BY email) AS rn FROM users WHERE role = 'parent' AND (email LIKE 'parent%@school.abh' OR email LIKE 'parent.%@school.abh')
),
students_ord AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM users WHERE role = 'student' AND class_id IS NOT NULL
),
pairs AS (
  SELECT par.id AS parent_id, s.child_id
  FROM parents par
  CROSS JOIN LATERAL (
    SELECT so.id AS child_id FROM students_ord so
    ORDER BY so.rn
    OFFSET (par.rn - 1) * 2 LIMIT 2
  ) s
)
INSERT INTO parent_children (id, parent_id, child_id)
SELECT gen_random_uuid(), parent_id, child_id FROM pairs
ON CONFLICT (parent_id, child_id) DO NOTHING;

-- ========== Demo aliases (@test.ru) — удобные логины для README/demo ==========
-- bcrypt("123456") — тот же hash, что и у остальных seed-пользователей.
INSERT INTO users (id, email, password_hash, name, role, class_id)
VALUES
  ('33333333-3333-3333-3333-333333333401'::uuid, 'admin@test.ru',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Администратор (демо)', 'admin', NULL),
  ('33333333-3333-3333-3333-333333333402'::uuid, 'teacher@test.ru',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Камкия Инга Рауфовна', 'teacher', NULL),
  ('33333333-3333-3333-3333-333333333403'::uuid, 'user@test.ru',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Шамба Астамур (демо)', 'student',
   '11111111-1111-1111-1111-111111111101'::uuid),
  ('33333333-3333-3333-3333-333333333404'::uuid, 'parent@test.ru',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Родитель (демо)', 'parent', NULL),
  ('33333333-3333-3333-3333-333333333405'::uuid, 'pending@test.ru',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Заявка (демо)', 'pending', NULL)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  class_id = EXCLUDED.class_id;

INSERT INTO students (id, user_id, class_id, name, class_name)
SELECT gen_random_uuid(), u.id, u.class_id, u.name, c.name
FROM users u
JOIN classes c ON c.id = u.class_id
WHERE u.email = 'user@test.ru'
  AND NOT EXISTS (SELECT 1 FROM students s WHERE s.user_id = u.id);

INSERT INTO teacher_subjects (id, teacher_id, subject_id)
SELECT gen_random_uuid(), te.id, ts.subject_id
FROM users te
JOIN users tr ON tr.email = 't.rus.1@school.abh'
JOIN teacher_subjects ts ON ts.teacher_id = tr.id
WHERE te.email = 'teacher@test.ru'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_subjects x
    WHERE x.teacher_id = te.id AND x.subject_id = ts.subject_id
  );

INSERT INTO teacher_classes (id, teacher_id, class_id)
SELECT gen_random_uuid(), te.id, tc.class_id
FROM users te
JOIN users tr ON tr.email = 't.rus.1@school.abh'
JOIN teacher_classes tc ON tc.teacher_id = tr.id
WHERE te.email = 'teacher@test.ru'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_classes x
    WHERE x.teacher_id = te.id AND x.class_id = tc.class_id
  );

-- teacher@test.ru ведёт 5А; t.rus.1@school.abh сохраняет 9А и остальные назначения.
UPDATE class_subjects cs
SET teacher_id = (SELECT id FROM users WHERE email = 'teacher@test.ru')
FROM classes c
WHERE cs.class_id = c.id
  AND c.name = '5А'
  AND cs.teacher_id = (SELECT id FROM users WHERE email = 't.rus.1@school.abh');

UPDATE schedule_slots ss
SET
  teacher_id = te.id,
  teacher_name = te.name
FROM classes c, users te
WHERE ss.class_id = c.id
  AND c.name = '5А'
  AND te.email = 'teacher@test.ru';

INSERT INTO parent_children (id, parent_id, child_id)
SELECT gen_random_uuid(), par.id, ch.id
FROM users par
CROSS JOIN LATERAL (
  SELECT u.id
  FROM users u
  WHERE u.role = 'student'
    AND u.class_id = '11111111-1111-1111-1111-111111111101'::uuid
  ORDER BY u.email
  LIMIT 2
) ch(id)
WHERE par.email = 'parent@test.ru'
ON CONFLICT (parent_id, child_id) DO NOTHING;

-- Проверка пересечений учителей (должно быть пусто)
-- SELECT day_label, lesson_number, teacher_name, count(*)
-- FROM schedule_slots
-- WHERE class_id IN (
--   '11111111-1111-1111-1111-111111111101'::uuid,
--   '11111111-1111-1111-1111-111111111102'::uuid,
--   '11111111-1111-1111-1111-111111111103'::uuid
-- )
-- GROUP BY day_label, lesson_number, teacher_name
-- HAVING count(*) > 1;

-- Проверка разнообразия по классу (должно быть > 1)
-- SELECT c.name, count(DISTINCT subj.name) AS distinct_subjects
-- FROM schedule_slots ss
-- JOIN classes c ON c.id = ss.class_id
-- JOIN subjects subj ON subj.id = ss.subject_id
-- WHERE c.id IN (
--   '11111111-1111-1111-1111-111111111101'::uuid,
--   '11111111-1111-1111-1111-111111111102'::uuid,
--   '11111111-1111-1111-1111-111111111103'::uuid
-- )
-- GROUP BY c.name;

-- ====== Проверки ======
-- 1) Нет пересечений учителей в одном слоте:
-- SELECT day_label, lesson_number, teacher_name, count(*)
-- FROM schedule_slots
-- GROUP BY day_label, lesson_number, teacher_name
-- HAVING count(*) > 1;

-- 2) Сколько слотов на класс:
-- SELECT c.name, count(*) FROM schedule_slots ss JOIN classes c ON c.id=ss.class_id GROUP BY c.name ORDER BY c.name;

-- 3) Кол-во учеников:
-- SELECT c.name, count(*) FROM users u JOIN classes c ON c.id=u.class_id WHERE u.role='student' GROUP BY c.name ORDER BY c.name;