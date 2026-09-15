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
  }
]
