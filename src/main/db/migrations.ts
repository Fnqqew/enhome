// Migraciones en orden. Nunca editar una ya publicada: agregar una nueva al final.

export interface Migration {
  version: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'esquema inicial',
    sql: `
      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Un solo usuario: una sola fila.
      CREATE TABLE player (
        id                 INTEGER PRIMARY KEY CHECK (id = 1),
        cefr_level         TEXT,
        xp                 INTEGER NOT NULL DEFAULT 0,
        player_level       INTEGER NOT NULL DEFAULT 1,
        streak             INTEGER NOT NULL DEFAULT 0,
        best_streak        INTEGER NOT NULL DEFAULT 0,
        last_practice_date TEXT,
        placement_done_at  TEXT,
        created_at         TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO player (id) VALUES (1);

      CREATE TABLE topic_progress (
        topic_id        TEXT PRIMARY KEY,
        cefr_level      TEXT NOT NULL,
        status          TEXT NOT NULL CHECK (status IN ('locked', 'available', 'in_progress', 'passed', 'review')),
        week_start      TEXT,
        attempts        INTEGER NOT NULL DEFAULT 0,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        best_grade      REAL,
        passed_at       TEXT,
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE day_progress (
        id           INTEGER PRIMARY KEY,
        topic_id     TEXT NOT NULL REFERENCES topic_progress (topic_id),
        week_start   TEXT NOT NULL,
        day_index    INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 5),
        subtopic_id  TEXT NOT NULL,
        date         TEXT NOT NULL,
        status       TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'missed', 'recovered')),
        completed_at TEXT,
        UNIQUE (topic_id, week_start, day_index)
      );

      CREATE TABLE exercises (
        id          INTEGER PRIMARY KEY,
        topic_id    TEXT NOT NULL,
        subtopic_id TEXT NOT NULL,
        skill       TEXT NOT NULL CHECK (skill IN ('grammar', 'reading', 'writing')),
        type        TEXT NOT NULL,
        payload     TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE exercise_attempts (
        id          INTEGER PRIMARY KEY,
        exercise_id INTEGER NOT NULL REFERENCES exercises (id),
        answer      TEXT NOT NULL,
        correct     INTEGER,
        score       REAL,
        feedback    TEXT,
        user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE exams (
        id           INTEGER PRIMARY KEY,
        kind         TEXT NOT NULL CHECK (kind IN ('placement', 'weekly', 'mock')),
        topic_id     TEXT,
        status       TEXT NOT NULL CHECK (status IN ('in_progress', 'paused', 'submitted', 'voided')),
        questions    TEXT NOT NULL,
        grade        REAL,
        passed       INTEGER,
        pause_used   INTEGER NOT NULL DEFAULT 0,
        paused_at    TEXT,
        started_at   TEXT NOT NULL DEFAULT (datetime('now')),
        submitted_at TEXT
      );

      CREATE TABLE exam_answers (
        exam_id        INTEGER NOT NULL REFERENCES exams (id),
        question_index INTEGER NOT NULL,
        answer         TEXT,
        correct        INTEGER,
        topic_tag      TEXT NOT NULL,
        subtopic_tag   TEXT,
        PRIMARY KEY (exam_id, question_index)
      );

      CREATE TABLE summaries (
        id          INTEGER PRIMARY KEY,
        topic_id    TEXT NOT NULL,
        type        TEXT NOT NULL,
        content     TEXT NOT NULL,
        source      TEXT NOT NULL CHECK (source IN ('base', 'ai')),
        user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE achievements (
        id          TEXT PRIMARY KEY,
        unlocked_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE inventory (
        item     TEXT PRIMARY KEY,
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0)
      );
    `
  },
  {
    version: 2,
    name: 'semanas y unidades de práctica',
    sql: `
      DROP TABLE day_progress;

      -- Una fila por semana de calendario dedicada a un tópico.
      CREATE TABLE weeks (
        id           INTEGER PRIMARY KEY,
        topic_id     TEXT NOT NULL,
        week_start   TEXT NOT NULL UNIQUE,
        starts_on    TEXT NOT NULL,
        kind         TEXT NOT NULL CHECK (kind IN ('normal', 'carry', 'retry')),
        status       TEXT NOT NULL CHECK (status IN ('active', 'passed', 'failed', 'incomplete')),
        recovered_on TEXT,
        exam_id      INTEGER REFERENCES exams (id),
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Las 5 prácticas de la semana, en orden.
      CREATE TABLE practice_units (
        id           INTEGER PRIMARY KEY,
        week_id      INTEGER NOT NULL REFERENCES weeks (id),
        unit_index   INTEGER NOT NULL CHECK (unit_index BETWEEN 1 AND 5),
        kind         TEXT NOT NULL CHECK (kind IN ('lesson', 'focus', 'review')),
        topic_id     TEXT NOT NULL,
        subtopic_id  TEXT NOT NULL,
        completed_on TEXT,
        UNIQUE (week_id, unit_index)
      );
    `
  },
  {
    version: 3,
    name: 'sesiones de práctica',
    sql: `
      -- Una sesión por práctica del día (o por recuperación del domingo, sin unidad).
      CREATE TABLE practice_sessions (
        id           INTEGER PRIMARY KEY,
        week_id      INTEGER NOT NULL REFERENCES weeks (id),
        unit_id      INTEGER UNIQUE REFERENCES practice_units (id),
        topic_id     TEXT NOT NULL,
        subtopic_id  TEXT NOT NULL,
        kind         TEXT NOT NULL CHECK (kind IN ('lesson', 'focus', 'review')),
        completed_on TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Los ejercicios generados para una sesión: slot es su posición; NULL = alternativa sin usar.
      ALTER TABLE exercises ADD COLUMN session_id INTEGER REFERENCES practice_sessions (id);
      ALTER TABLE exercises ADD COLUMN slot INTEGER;
      ALTER TABLE exercises ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX exercises_session ON exercises (session_id);
      CREATE INDEX exercises_subtopic ON exercises (topic_id, subtopic_id);
    `
  },
  {
    version: 4,
    name: 'un resumen por tópico y tipo',
    sql: `
      CREATE UNIQUE INDEX summaries_topic_type ON summaries (topic_id, type);
    `
  },
  {
    version: 5,
    name: 'exámenes semanales y simulacros',
    sql: `
      ALTER TABLE exams ADD COLUMN week_id INTEGER;
      ALTER TABLE exams ADD COLUMN scope TEXT;
      ALTER TABLE exams ADD COLUMN started_on TEXT;
      ALTER TABLE exams ADD COLUMN last_seen_at TEXT;
      ALTER TABLE exams ADD COLUMN end_reason TEXT;
      ALTER TABLE exam_answers ADD COLUMN score REAL;
      ALTER TABLE exam_answers ADD COLUMN feedback TEXT;

      -- Preguntas del examen semanal preparadas de antemano (se consumen al empezar).
      CREATE TABLE exam_drafts (
        week_id    INTEGER PRIMARY KEY REFERENCES weeks (id),
        questions  TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `
  },
  {
    version: 6,
    name: 'recompensas: experiencia, rachas y comodines',
    sql: `
      -- Experiencia ganada; source identifica qué la originó para no darla dos veces.
      CREATE TABLE xp_events (
        id         INTEGER PRIMARY KEY,
        source     TEXT NOT NULL UNIQUE,
        amount     INTEGER NOT NULL,
        created_on TEXT NOT NULL
      );

      -- Días hábiles faltados ya resueltos: protegidos por un comodín o que cortaron la racha.
      CREATE TABLE streak_days (
        date    TEXT PRIMARY KEY,
        outcome TEXT NOT NULL CHECK (outcome IN ('protected', 'broken'))
      );

      -- Comodines otorgados (una vez por hito).
      CREATE TABLE reward_grants (
        source     TEXT PRIMARY KEY,
        item       TEXT NOT NULL,
        granted_on TEXT NOT NULL
      );

      CREATE TABLE powerup_uses (
        id      INTEGER PRIMARY KEY,
        item    TEXT NOT NULL,
        context TEXT NOT NULL UNIQUE,
        detail  TEXT,
        used_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Avisos para mostrar al alumno (logros, niveles, comodines).
      CREATE TABLE reward_news (
        id         INTEGER PRIMARY KEY,
        kind       TEXT NOT NULL,
        message    TEXT NOT NULL,
        seen       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `
  },
  {
    version: 7,
    name: 'comentarios del usuario',
    sql: `
      -- Lo que el usuario anota sobre la app: ideas, cosas que fallan y lo que le gusta.
      CREATE TABLE feedback (
        id         INTEGER PRIMARY KEY,
        kind       TEXT NOT NULL CHECK (kind IN ('idea', 'problema', 'gusto')),
        section    TEXT NOT NULL,
        message    TEXT NOT NULL,
        done       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `
  },
  {
    version: 8,
    name: 'pausas del curso',
    sql: `
      -- Mientras un curso está en pausa sus días no cuentan como faltas ni cortan la racha.
      -- resumed_on NULL es la pausa en curso; el día de la reanudación ya cuenta.
      CREATE TABLE course_pauses (
        id         INTEGER PRIMARY KEY,
        paused_on  TEXT NOT NULL,
        resumed_on TEXT,
        CHECK (resumed_on IS NULL OR resumed_on > paused_on)
      );
    `
  },
  {
    version: 9,
    name: 'índices, tiempos de Claude y mantenimiento',
    sql: `
      CREATE INDEX exercise_attempts_exercise ON exercise_attempts (exercise_id);
      CREATE INDEX practice_sessions_week ON practice_sessions (week_id);
      CREATE INDEX exams_week ON exams (week_id);

      -- Cuánto tarda cada pedido a Claude (se guardan los últimos).
      CREATE TABLE claude_timings (
        id         INTEGER PRIMARY KEY,
        label      TEXT NOT NULL,
        model      TEXT NOT NULL,
        effort     TEXT,
        ms         INTEGER NOT NULL,
        attempts   INTEGER NOT NULL,
        ok         INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Fechas de las tareas de mantenimiento (limpieza, compactación).
      CREATE TABLE maintenance (
        task    TEXT PRIMARY KEY,
        last_on TEXT NOT NULL
      );
    `
  },
  {
    version: 10,
    name: 'repaso, vocabulario, juegos, lecturas y diario',
    sql: `
      -- Cuaderno de errores: cada respuesta incorrecta vuelve a los 1, 3, 7 y 15 días hasta acertarla.
      CREATE TABLE mistakes (
        id          INTEGER PRIMARY KEY,
        source      TEXT NOT NULL CHECK (source IN ('practice', 'exam')),
        source_id   INTEGER NOT NULL,
        item_index  INTEGER NOT NULL DEFAULT 0,
        topic_id    TEXT NOT NULL,
        subtopic_id TEXT NOT NULL,
        payload     TEXT NOT NULL,
        given       TEXT,
        stage       INTEGER NOT NULL DEFAULT 0,
        due_on      TEXT NOT NULL,
        reviews     INTEGER NOT NULL DEFAULT 0,
        resolved_on TEXT,
        created_on  TEXT NOT NULL,
        UNIQUE (source, source_id, item_index)
      );
      CREATE INDEX mistakes_due ON mistakes (resolved_on, due_on);

      -- Palabras guardadas con su traducción, para repasar con tarjetas.
      CREATE TABLE vocab (
        id          INTEGER PRIMARY KEY,
        term        TEXT NOT NULL UNIQUE,
        translation TEXT NOT NULL,
        example     TEXT,
        example_es  TEXT,
        note        TEXT,
        topic_id    TEXT,
        stage       INTEGER NOT NULL DEFAULT 0,
        due_on      TEXT NOT NULL,
        created_on  TEXT NOT NULL
      );

      -- Partidas de los juegos, para los récords y la experiencia del día.
      CREATE TABLE game_scores (
        id         INTEGER PRIMARY KEY,
        game       TEXT NOT NULL,
        score      INTEGER NOT NULL,
        detail     TEXT,
        played_on  TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX game_scores_game ON game_scores (game, score);

      -- Lecturas graduadas generadas por Claude, guardadas para releer.
      CREATE TABLE readings (
        id         INTEGER PRIMARY KEY,
        level      TEXT NOT NULL,
        topic_id   TEXT,
        title      TEXT NOT NULL,
        content    TEXT NOT NULL,
        answers    TEXT,
        score      INTEGER,
        created_on TEXT NOT NULL
      );

      -- Diario en el idioma: una entrada por día, corregida por Claude.
      CREATE TABLE journal (
        id         INTEGER PRIMARY KEY,
        day        TEXT NOT NULL UNIQUE,
        text       TEXT NOT NULL,
        review     TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );

      -- Revisión de tópicos desde la app: el contenido corregido y la fecha en que se marcó como revisado.
      CREATE TABLE topic_reviews (
        topic_id    TEXT PRIMARY KEY,
        content     TEXT,
        reviewed_on TEXT
      );
    `
  },
  {
    version: 11,
    name: 'charla con Claude',
    sql: `
      -- Conversaciones libres en el idioma del curso.
      CREATE TABLE chats (
        id         INTEGER PRIMARY KEY,
        title      TEXT NOT NULL,
        scenario   TEXT NOT NULL,
        level      TEXT NOT NULL,
        created_on TEXT NOT NULL
      );

      -- Cada mensaje; los del alumno guardan la corrección que hizo Claude.
      CREATE TABLE chat_messages (
        id         INTEGER PRIMARY KEY,
        chat_id    INTEGER NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
        role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        text       TEXT NOT NULL,
        review     TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX chat_messages_chat ON chat_messages (chat_id);
    `
  },
  {
    version: 12,
    name: 'resaltados del modo lectura',
    sql: `
      -- Lo que el alumno resalta al leer un resumen o una lectura, con una nota opcional.
      CREATE TABLE highlights (
        id         INTEGER PRIMARY KEY,
        doc_key    TEXT NOT NULL,
        text       TEXT NOT NULL,
        note       TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX highlights_doc ON highlights (doc_key);
    `
  },
  {
    version: 13,
    name: 'tiempo de estudio',
    sql: `
      -- Segundos de estudio de cada día (con la ventana activa y en una sección de estudio).
      CREATE TABLE study_time (
        day     TEXT PRIMARY KEY,
        seconds INTEGER NOT NULL DEFAULT 0
      );
    `
  },
  {
    version: 14,
    name: 'un solo repaso con FSRS',
    sql: `
      -- Todo lo que se repasa (errores, palabras, frases y oraciones) en una sola tabla, con el estado
      -- de memoria de FSRS: cada tarjeta vuelve justo antes de que se olvide.
      CREATE TABLE cards (
        id          INTEGER PRIMARY KEY,
        kind        TEXT NOT NULL CHECK (kind IN ('mistake', 'word', 'phrase', 'sentence')),
        -- De dónde viene (practice, exam, vocab, reading…) y una clave para no anotar dos veces lo mismo.
        source      TEXT NOT NULL,
        source_key  TEXT NOT NULL,
        topic_id    TEXT,
        subtopic_id TEXT,
        -- Lo que se pregunta y la respuesta (palabras y frases); los errores guardan su ejercicio en payload.
        front       TEXT NOT NULL DEFAULT '',
        back        TEXT NOT NULL DEFAULT '',
        payload     TEXT,
        given       TEXT,
        due_on      TEXT NOT NULL,
        stability   REAL NOT NULL DEFAULT 0,
        difficulty  REAL NOT NULL DEFAULT 0,
        reps        INTEGER NOT NULL DEFAULT 0,
        lapses      INTEGER NOT NULL DEFAULT 0,
        state       INTEGER NOT NULL DEFAULT 0,
        last_review TEXT,
        created_on  TEXT NOT NULL,
        UNIQUE (kind, source, source_key)
      );
      CREATE INDEX cards_due ON cards (kind, due_on);

      -- Cada repaso, para las estadísticas, la experiencia y, con el tiempo, ajustar FSRS a vos.
      CREATE TABLE card_reviews (
        id          INTEGER PRIMARY KEY,
        card_id     INTEGER NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
        day         TEXT NOT NULL,
        rating      INTEGER NOT NULL,
        interval    INTEGER NOT NULL
      );
      CREATE INDEX card_reviews_card ON card_reviews (card_id);

      -- Los errores conservan su número (la experiencia ya ganada se calcula con él).
      INSERT INTO cards (id, kind, source, source_key, topic_id, subtopic_id, payload, given, due_on, stability, difficulty, reps, state, last_review, created_on)
        SELECT id, 'mistake', source, source_id || ':' || item_index, topic_id, subtopic_id, payload, given,
               CASE WHEN resolved_on IS NOT NULL THEN date(resolved_on, '+60 days') ELSE due_on END,
               CASE WHEN resolved_on IS NOT NULL THEN 60 WHEN stage = 1 THEN 3 WHEN stage = 2 THEN 7 WHEN stage >= 3 THEN 15 ELSE 0 END,
               CASE WHEN stage > 0 OR resolved_on IS NOT NULL THEN 5 ELSE 0 END,
               reviews,
               CASE WHEN stage > 0 OR resolved_on IS NOT NULL THEN 2 ELSE 0 END,
               COALESCE(resolved_on, CASE WHEN stage > 0 THEN date(due_on, '-' || CASE stage WHEN 1 THEN 3 WHEN 2 THEN 7 ELSE 15 END || ' days') END),
               created_on
          FROM mistakes;
      -- Los repasos acertados de antes quedan en el historial (uno por escalón alcanzado).
      INSERT INTO card_reviews (card_id, day, rating, interval)
        WITH RECURSIVE steps(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM steps WHERE n < 4)
        SELECT m.id, COALESCE(m.resolved_on, m.due_on), 3, 0
          FROM mistakes m JOIN steps ON steps.n <= CASE WHEN m.resolved_on IS NOT NULL THEN 4 ELSE m.stage END;

      INSERT INTO cards (kind, source, source_key, topic_id, front, back, payload, due_on, stability, difficulty, reps, state, last_review, created_on)
        SELECT 'word', 'vocab', lower(term), topic_id, term, translation,
               json_object('example', COALESCE(example, ''), 'exampleEs', COALESCE(example_es, ''), 'note', COALESCE(note, '')),
               due_on,
               CASE stage WHEN 0 THEN 0 WHEN 1 THEN 3 WHEN 2 THEN 7 WHEN 3 THEN 15 WHEN 4 THEN 30 ELSE 60 END,
               CASE WHEN stage > 0 THEN 5 ELSE 0 END,
               stage,
               CASE WHEN stage > 0 THEN 2 ELSE 0 END,
               CASE WHEN stage > 0 THEN date(due_on, '-' || CASE stage WHEN 1 THEN 3 WHEN 2 THEN 7 WHEN 3 THEN 15 WHEN 4 THEN 30 ELSE 60 END || ' days') END,
               created_on
          FROM vocab;

      DROP TABLE mistakes;
      DROP TABLE vocab;
    `
  },
  {
    version: 15,
    name: 'bancos de ejercicios',
    sql: `
      -- Ejercicios cortos que la app generó (y revisó) en segundo plano para sumar al banco del temario.
      CREATE TABLE bank_exercises (
        id          INTEGER PRIMARY KEY,
        topic_id    TEXT NOT NULL,
        subtopic_id TEXT NOT NULL,
        type        TEXT NOT NULL,
        payload     TEXT NOT NULL,
        created_on  TEXT NOT NULL
      );
      CREATE INDEX bank_exercises_subtopic ON bank_exercises (topic_id, subtopic_id);
    `
  }
]
