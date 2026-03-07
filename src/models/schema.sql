CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rut VARCHAR(20) UNIQUE,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_postings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  requirements JSONB,
  salary_range JSONB,
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  rut VARCHAR(20),
  cv_file_path TEXT,
  cv_parsed_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  job_posting_id INTEGER REFERENCES job_postings(id),
  candidate_id INTEGER REFERENCES candidates(id),
  status VARCHAR(50) DEFAULT 'received',
  ai_score INTEGER,
  ai_analysis JSONB,
  competency_test_score INTEGER,
  competency_test_results JSONB,
  interview_transcript TEXT,
  interview_score INTEGER,
  verification_status VARCHAR(50),
  verification_results JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_posting_id, candidate_id)
);

CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id),
  action VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_applications_job ON applications(job_posting_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);
CREATE INDEX idx_applications_status ON applications(status);