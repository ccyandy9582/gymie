CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  age INT,
  gender VARCHAR(10),
  height_cm DECIMAL(5,1),
  weight_kg DECIMAL(5,1),
  goal VARCHAR(30),
  fitness_level VARCHAR(15),
  unit_system VARCHAR(10) DEFAULT 'metric',
  training_type VARCHAR(10) DEFAULT 'hybrid',
  available_days INT[] DEFAULT '{1,3,5,6}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(10),
  goal TEXT,
  duration_weeks INT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt TEXT,
  status VARCHAR(10) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  day_of_week INT NOT NULL,
  type VARCHAR(10),
  notes TEXT
);

CREATE TABLE plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id UUID REFERENCES plan_days(id) ON DELETE CASCADE,
  exercise_name VARCHAR(200) NOT NULL,
  sets INT,
  reps INT,
  weight_kg DECIMAL(6,2),
  distance_km DECIMAL(6,2),
  pace_per_km VARCHAR(10),
  order_index INT DEFAULT 0
);

CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_day_id UUID REFERENCES plan_days(id),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  total_volume_kg DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_name VARCHAR(200) NOT NULL,
  set_number INT NOT NULL,
  reps INT NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL,
  is_pr BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE run_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_day_id UUID REFERENCES plan_days(id),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  distance_km DECIMAL(6,2),
  duration_sec INT,
  avg_pace VARCHAR(10),
  avg_heart_rate INT,
  calories INT,
  route_geojson JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE run_laps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_session_id UUID REFERENCES run_sessions(id) ON DELETE CASCADE,
  lap_number INT NOT NULL,
  distance_km DECIMAL(5,2),
  duration_sec INT,
  pace VARCHAR(10),
  heart_rate INT
);

CREATE TABLE prompt_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  input_variables JSONB NOT NULL,
  raw_response TEXT,
  was_accepted BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
