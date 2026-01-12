-- =========================================================
-- BOOTSTRAP "BATTLE" DATA (REALISTIC LINKS)
-- Replace blocks: parent_children, teacher_subjects, teacher_classes,
-- class_subjects, schedule_slots, lessons, grades, lesson_attendances, homework
-- =========================================================

-- 0) Пересобираем связи и учебные данные
TRUNCATE
lesson_attendances,
grades,
lessons,
homework,
schedule_slots,
class_subjects,
teacher_classes,
teacher_subjects,
parent_children
CASCADE;

-- =========================================================
-- ADMIN USER
-- =========================================================

INSERT INTO users (id, email, password_hash, name, role, class_id)
VALUES
  ('33333333-3333-3333-3333-333333333301'::uuid, 'admin@abh-edu.local',
   '$2b$12$0QBDDybkhTa3zLMQERiV9OpJ5Ci/CR15vfzB1DqJRBKy2KJeJkl6u', 'Администратор системы', 'admin', NULL)
ON CONFLICT (email) DO NOTHING;


-- =========================================================
-- 1) Родители: 1..3 ребёнка на родителя (реалистично)
-- =========================================================

WITH parents AS (
  SELECT id AS parent_id, row_number() OVER (ORDER BY id) rn
  FROM users
  WHERE role='parent'
),
children AS (
  SELECT id AS child_id, row_number() OVER (ORDER BY random()) rn
  FROM users
  WHERE role='student'
),
links AS (
  -- каждому родителю назначаем 1..3 детей
  SELECT
    p.parent_id,
    c.child_id,
    row_number() OVER (PARTITION BY p.parent_id ORDER BY random()) k
  FROM parents p
  JOIN LATERAL (
    SELECT child_id
    FROM children
    ORDER BY random()
    LIMIT (1 + floor(random()*3))::int
  ) c ON TRUE
)
INSERT INTO parent_children (id, parent_id, child_id)
SELECT gen_random_uuid(), parent_id, child_id
FROM links
WHERE k <= 3
ON CONFLICT DO NOTHING;

-- =========================================================
-- 2) Учителя: назначаем 1..2 предмета каждому (но равномернее)
-- =========================================================

WITH t AS (
  SELECT id AS teacher_id, row_number() OVER (ORDER BY id) rn
  FROM users WHERE role='teacher'
),
s AS (
  SELECT id AS subject_id, row_number() OVER (ORDER BY id) rn
  FROM subjects
),
base AS (
  -- каждому учителю даём 1 основной предмет по кругу
  SELECT
    t.teacher_id,
    s.subject_id
  FROM t
  JOIN s ON ((t.rn - 1) % (SELECT count(*) FROM subjects)) + 1 = s.rn
),
extra AS (
  -- части учителей добавляем второй предмет (30%)
  SELECT
    teacher_id,
    (SELECT subject_id FROM subjects ORDER BY random() LIMIT 1) AS subject_id
  FROM t
  WHERE random() < 0.30
)
INSERT INTO teacher_subjects (id, teacher_id, subject_id)
SELECT gen_random_uuid(), teacher_id, subject_id FROM (
  SELECT * FROM base
  UNION ALL
  SELECT * FROM extra
) x
ON CONFLICT DO NOTHING;

-- =========================================================
-- 3) Учителя закреплены за 1..3 классами (умеренно)
-- =========================================================

WITH teachers AS (
  SELECT id AS teacher_id
  FROM users WHERE role='teacher'
),
links AS (
  SELECT
    t.teacher_id,
    c.id AS class_id,
    row_number() OVER (PARTITION BY t.teacher_id ORDER BY random()) k
  FROM teachers t
  JOIN classes c ON random() < 0.25  -- вероятность связи, затем ограничим
)
INSERT INTO teacher_classes (id, teacher_id, class_id)
SELECT gen_random_uuid(), teacher_id, class_id
FROM links
WHERE k <= (1 + floor(random()*3))::int
ON CONFLICT DO NOTHING;

-- =========================================================
-- 4) Реалистичные предметы в классах (не все 11)
--    5 класс: без химии и физики, 10-11: с химией, физикой чаще
-- =========================================================

WITH subj AS (
  SELECT id, name FROM subjects
),
cls AS (
  SELECT id, grade FROM classes
),
wanted AS (
  SELECT
    c.id AS class_id,
    s.id AS subject_id
  FROM cls c
  JOIN subj s ON TRUE
  WHERE
    (
      c.grade BETWEEN 5 AND 6 AND s.name IN
      ('Математика','Русский язык','Литература','История','География','Биология','Информатика','Английский язык','Физкультура')
    )
    OR
    (
      c.grade BETWEEN 7 AND 9 AND s.name IN
      ('Математика','Русский язык','Литература','История','География','Биология','Информатика','Английский язык','Физкультура','Физика')
    )
    OR
    (
      c.grade BETWEEN 10 AND 11 AND s.name IN
      ('Математика','Русский язык','Литература','История','География','Биология','Информатика','Английский язык','Физкультура','Физика','Химия')
    )
),
pick_teacher AS (
  SELECT
    w.class_id,
    w.subject_id,
    (
      SELECT ts.teacher_id
      FROM teacher_subjects ts
      JOIN teacher_classes tc ON tc.teacher_id = ts.teacher_id AND tc.class_id = w.class_id
      WHERE ts.subject_id = w.subject_id
      ORDER BY random()
      LIMIT 1
    ) AS teacher_id
  FROM wanted w
)
INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
SELECT
  gen_random_uuid(),
  class_id,
  subject_id,
  COALESCE(
    teacher_id,
    (SELECT ts.teacher_id FROM teacher_subjects ts WHERE ts.subject_id = pick_teacher.subject_id ORDER BY random() LIMIT 1)
  ) AS teacher_id
FROM pick_teacher
ON CONFLICT DO NOTHING;

-- =========================================================
-- 5) Недельное расписание (Пн-Пт) 6 уроков в день
--    Распределение предметов с весами (математика чаще, физра реже)
-- =========================================================

WITH days AS (
  SELECT * FROM (VALUES
    ('Понедельник', 1),
    ('Вторник', 2),
    ('Среда', 3),
    ('Четверг', 4),
    ('Пятница', 5)
  ) d(day_label, dow)
),
times AS (
  SELECT * FROM (VALUES
    (1,'08:30'),
    (2,'09:20'),
    (3,'10:20'),
    (4,'11:10'),
    (5,'12:10'),
    (6,'13:00')
  ) t(lesson_number, time)
),
pool AS (
  -- делаем "мешок" предметов с весами внутри каждого класса
  -- math/ru/en чаще, physed реже
  SELECT
    cs.class_id,
    cs.subject_id,
    cs.teacher_id,
    s.name,
    CASE
      WHEN s.name='Математика' THEN 6
      WHEN s.name='Русский язык' THEN 5
      WHEN s.name='Английский язык' THEN 4
      WHEN s.name='История' THEN 3
      WHEN s.name='Информатика' THEN 3
      WHEN s.name='Физика' THEN 3
      WHEN s.name='Химия' THEN 2
      WHEN s.name='Биология' THEN 2
      WHEN s.name='География' THEN 2
      WHEN s.name='Литература' THEN 2
      WHEN s.name='Физкультура' THEN 1
      ELSE 1
    END AS weight
  FROM class_subjects cs
  JOIN subjects s ON s.id = cs.subject_id
),
expanded AS (
  SELECT
    class_id, subject_id, teacher_id
  FROM pool
  JOIN LATERAL generate_series(1, weight) g ON TRUE
),
slots AS (
  SELECT
    c.id AS class_id,
    d.day_label,
    d.dow,
    t.lesson_number,
    t.time
  FROM classes c
  CROSS JOIN days d
  CROSS JOIN times t
),
chosen AS (
  SELECT
    sl.class_id,
    sl.day_label,
    sl.lesson_number,
    sl.time,
    e.subject_id,
    e.teacher_id,
    row_number() OVER (PARTITION BY sl.class_id, sl.day_label, sl.lesson_number ORDER BY random()) rn
  FROM slots sl
  JOIN expanded e ON e.class_id = sl.class_id
)
INSERT INTO schedule_slots (
  id, class_id, subject_id, day_label, lesson_number, time, shift, teacher_name, room, note, is_cancelled
)
SELECT
  gen_random_uuid(),
  c.class_id,
  c.subject_id,
  c.day_label,
  c.lesson_number,
  c.time,
  'first',
  u.name,
  (100 + floor(random()*30))::int::text,
  NULL,
  (random() < 0.02) -- 2% отмен
FROM chosen c
JOIN users u ON u.id = c.teacher_id
WHERE c.rn = 1;

-- =========================================================
-- 6) Уроки по расписанию за последние 8 недель (только Пн-Пт)
-- =========================================================

WITH dates AS (
  SELECT (CURRENT_DATE - offs)::date AS dt
  FROM generate_series(0, 55) offs
),
school_days AS (
  SELECT dt, EXTRACT(ISODOW FROM dt)::int AS isodow
  FROM dates
  WHERE EXTRACT(ISODOW FROM dt)::int BETWEEN 1 AND 5
),
day_name AS (
  SELECT
    dt,
    CASE isodow
      WHEN 1 THEN 'Понедельник'
      WHEN 2 THEN 'Вторник'
      WHEN 3 THEN 'Среда'
      WHEN 4 THEN 'Четверг'
      ELSE 'Пятница'
    END AS day_label
  FROM school_days
)
INSERT INTO lessons (
  id, subject_id, class_id, date, time, room, topic, homework_text
)
SELECT
  gen_random_uuid(),
  ss.subject_id,
  ss.class_id,
  dn.dt,
  ss.time,
  ss.room,
  'Тема: ' || (SELECT name FROM subjects s WHERE s.id = ss.subject_id) || ' — ' || dn.dt::text,
  CASE WHEN random() < 0.45 THEN 'ДЗ: выполнить упражнения и подготовить пересказ.' ELSE NULL END
FROM day_name dn
JOIN schedule_slots ss
  ON ss.day_label = dn.day_label
WHERE ss.is_cancelled = false;

-- =========================================================
-- 7) Посещаемость (урок + ученик своего класса)
-- =========================================================

INSERT INTO lesson_attendances (
  id, lesson_id, student_id, attendance, grade
)
SELECT
  gen_random_uuid(),
  l.id,
  st.id,
  CASE
    WHEN r < 0.92 THEN 'present'
    WHEN r < 0.98 THEN 'absent'
    ELSE 'late'
  END,
  NULL
FROM lessons l
JOIN users st ON st.role='student' AND st.class_id = l.class_id
CROSS JOIN LATERAL (SELECT random() AS r) rr;

-- =========================================================
-- 8) Оценки (строго по уроку, предмету, ученику класса)
--    Не каждый урок оценивается: 60% уроков имеют оценки
--    Оценка не ставится отсутствующим
-- =========================================================

INSERT INTO grades (
  id, student_id, subject_id, lesson_id, date, value
)
SELECT
  gen_random_uuid(),
  la.student_id,
  l.subject_id,
  l.id,
  l.date,
  CASE
    WHEN x < 0.06 THEN '2'
    WHEN x < 0.24 THEN '3'
    WHEN x < 0.62 THEN '4'
    ELSE '5'
  END
FROM lesson_attendances la
JOIN lessons l ON l.id = la.lesson_id
CROSS JOIN LATERAL (SELECT random() AS x) rx
WHERE la.attendance IN ('present','late')
  AND random() < 0.60;

-- синхронизация attendance.grade (если UI берет отсюда)
UPDATE lesson_attendances la
SET grade = g.value
FROM grades g
WHERE g.lesson_id = la.lesson_id AND g.student_id = la.student_id;

-- =========================================================
-- 9) Homework: реалистично на неделю вперед по предметам класса
-- =========================================================

WITH next_days AS (
  SELECT (CURRENT_DATE + offs)::date AS dt
  FROM generate_series(1, 14) offs
),
school_days AS (
  SELECT dt, EXTRACT(ISODOW FROM dt)::int AS isodow
  FROM next_days
  WHERE EXTRACT(ISODOW FROM dt)::int BETWEEN 1 AND 5
),
due_map AS (
  SELECT
    sd.dt AS due_date,
    CASE sd.isodow
      WHEN 1 THEN 'Понедельник'
      WHEN 2 THEN 'Вторник'
      WHEN 3 THEN 'Среда'
      WHEN 4 THEN 'Четверг'
      ELSE 'Пятница'
    END AS day_label
  FROM school_days sd
),
hw_rows AS (
  SELECT
    ss.class_id,
    ss.subject_id,
    dm.due_date,
    row_number() OVER (PARTITION BY ss.class_id, ss.subject_id, dm.due_date ORDER BY random()) rn
  FROM due_map dm
  JOIN schedule_slots ss ON ss.day_label = dm.day_label
)
INSERT INTO homework (id, subject_id, class_id, due_date, text, created_at)
SELECT
  gen_random_uuid(),
  subject_id,
  class_id,
  due_date,
  'Домашнее задание на ' || due_date::text || ': прочитать параграф, выполнить упражнения.',
  now()
FROM hw_rows
WHERE rn = 1
  AND random() < 0.55;  -- не каждый день по каждому предмету