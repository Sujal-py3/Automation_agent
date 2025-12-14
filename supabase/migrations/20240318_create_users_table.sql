-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  whatsapp_number TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_whatsapp_number ON users(whatsapp_number);

-- Add comments to explain the columns
COMMENT ON TABLE users IS 'User accounts with Google OAuth and WhatsApp integration';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.name IS 'User display name';
COMMENT ON COLUMN users.whatsapp_number IS 'WhatsApp number in E.164 format (e.g., +1234567890)';
COMMENT ON COLUMN users.google_access_token IS 'Google OAuth access token';
COMMENT ON COLUMN users.google_refresh_token IS 'Google OAuth refresh token';
COMMENT ON COLUMN users.google_token_expiry IS 'Google OAuth token expiry timestamp'; 