CREATE TABLE files (
    seed_code VARCHAR(255) PRIMARY KEY,
    file_path TEXT NOT NULL,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);
