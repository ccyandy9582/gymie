BEGIN;

DO $$
BEGIN
  IF to_regprocedure('set_updated_at()') IS NULL THEN
    CREATE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regprocedure('is_valid_training_days(integer[])') IS NULL THEN
    CREATE FUNCTION is_valid_training_days(days INT[])
    RETURNS BOOLEAN AS $fn$
    DECLARE
      day_count INT;
      distinct_count INT;
    BEGIN
      IF days IS NULL THEN
        RETURN FALSE;
      END IF;

      day_count := cardinality(days);
      IF day_count < 2 OR day_count > 7 THEN
        RETURN FALSE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM unnest(days) AS d
        WHERE d < 0 OR d > 6
      ) THEN
        RETURN FALSE;
      END IF;

      SELECT COUNT(DISTINCT d)
      INTO distinct_count
      FROM unnest(days) AS d;

      IF distinct_count <> day_count THEN
        RETURN FALSE;
      END IF;

      RETURN TRUE;
    END;
    $fn$ LANGUAGE plpgsql IMMUTABLE;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255) UNIQUE NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS body_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMPTZ NOT NULL,
  weight_kg       DECIMAL(5,1),
  body_fat_pct    DECIMAL(4,1),
  muscle_mass_kg  DECIMAL(5,1),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(30) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, category)
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  system_prompt   TEXT NOT NULL,
  user_prompt     TEXT NOT NULL,
  variables       JSONB NOT NULL,
  model           VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  temperature     DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  max_tokens      INT NOT NULL DEFAULT 2000,
  change_note     TEXT NOT NULL DEFAULT 'migration backfill',
  created_by      VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version)
);

ALTER TABLE users
  ALTER COLUMN available_days SET DEFAULT ARRAY[1,3,5,6];

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE training_plans
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE plan_days
  ADD COLUMN IF NOT EXISTS title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS duration_min INT,
  ADD COLUMN IF NOT EXISTS intensity_pct INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE plan_exercises
  ADD COLUMN IF NOT EXISTS pace_sec_per_km INT,
  ADD COLUMN IF NOT EXISTS run_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS status VARCHAR(15),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE workout_sessions
SET status = CASE WHEN ended_at IS NULL THEN 'in_progress' ELSE 'completed' END
WHERE status IS NULL;

ALTER TABLE workout_sessions
  ALTER COLUMN status SET DEFAULT 'in_progress';

ALTER TABLE run_sessions
  ADD COLUMN IF NOT EXISTS avg_pace_sec_per_km INT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(15),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE run_sessions
SET status = CASE WHEN ended_at IS NULL THEN 'in_progress' ELSE 'completed' END
WHERE status IS NULL;

ALTER TABLE run_sessions
  ALTER COLUMN status SET DEFAULT 'in_progress';

ALTER TABLE run_laps
  ADD COLUMN IF NOT EXISTS pace_sec_per_km INT;

ALTER TABLE prompt_usage_logs
  ADD COLUMN IF NOT EXISTS version_id UUID,
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS input_tokens INT,
  ADD COLUMN IF NOT EXISTS output_tokens INT,
  ADD COLUMN IF NOT EXISTS latency_ms INT,
  ADD COLUMN IF NOT EXISTS feedback_score INT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

UPDATE prompt_usage_logs
SET was_accepted = FALSE
WHERE was_accepted IS NULL;

ALTER TABLE prompt_usage_logs
  ALTER COLUMN was_accepted SET DEFAULT FALSE;

ALTER TABLE prompt_usage_logs
  ALTER COLUMN was_accepted SET NOT NULL;

UPDATE prompt_usage_logs
SET request_id = gen_random_uuid()
WHERE request_id IS NULL;

ALTER TABLE prompt_usage_logs
  ALTER COLUMN request_id SET DEFAULT gen_random_uuid();

ALTER TABLE prompt_usage_logs
  ALTER COLUMN request_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_prompt_usage_logs_version_id'
  ) THEN
    ALTER TABLE prompt_usage_logs
      ADD CONSTRAINT fk_prompt_usage_logs_version_id
      FOREIGN KEY (version_id) REFERENCES prompt_versions(id) ON DELETE SET NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_sessions_user_date ON run_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_session ON exercise_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_run_laps_session ON run_laps(run_session_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_current ON prompt_versions(template_id, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_prompt_usage_version ON prompt_usage_logs(version_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_usage_logs_request_id ON prompt_usage_logs(request_id);

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_users_updated_at ON users';
    EXECUTE 'CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;

  IF to_regclass('public.user_credentials') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_user_credentials_updated_at ON user_credentials';
    EXECUTE 'CREATE TRIGGER trg_user_credentials_updated_at BEFORE UPDATE ON user_credentials FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;

  IF to_regclass('public.training_plans') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_training_plans_updated_at ON training_plans';
    EXECUTE 'CREATE TRIGGER trg_training_plans_updated_at BEFORE UPDATE ON training_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;

  IF to_regclass('public.workout_sessions') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_workout_sessions_updated_at ON workout_sessions';
    EXECUTE 'CREATE TRIGGER trg_workout_sessions_updated_at BEFORE UPDATE ON workout_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;

  IF to_regclass('public.run_sessions') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_run_sessions_updated_at ON run_sessions';
    EXECUTE 'CREATE TRIGGER trg_run_sessions_updated_at BEFORE UPDATE ON run_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;

  IF to_regclass('public.prompt_templates') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_prompt_templates_updated_at ON prompt_templates';
    EXECUTE 'CREATE TRIGGER trg_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END;
$$ LANGUAGE plpgsql;

INSERT INTO prompt_templates (name, category, description, is_active)
VALUES (
  'Plan Generation v1',
  'plan_generation',
  'MVP training plan generation template',
  TRUE
)
ON CONFLICT (name, category) DO NOTHING;

WITH plan_template AS (
  SELECT id
  FROM prompt_templates
  WHERE name = 'Plan Generation v1' AND category = 'plan_generation'
  LIMIT 1
)
INSERT INTO prompt_versions (
  template_id,
  version,
  is_current,
  system_prompt,
  user_prompt,
  variables,
  model,
  temperature,
  max_tokens,
  change_note,
  created_by
)
SELECT
  plan_template.id,
  1,
  TRUE,
  $$你是一位擁有 10 年經驗的專業運動教練，專精於週期化訓練規劃。$$,
  $$請輸出訓練計劃 JSON。$$,
  '{"age":"Int","gender":"String","weight_kg":"Float","height_cm":"Float"}'::jsonb,
  'claude-sonnet-4-20250514',
  0.7,
  2000,
  'schema repair backfill',
  'system'
FROM plan_template
WHERE NOT EXISTS (
  SELECT 1
  FROM prompt_versions pv
  WHERE pv.template_id = plan_template.id AND pv.version = 1
);

COMMIT;
