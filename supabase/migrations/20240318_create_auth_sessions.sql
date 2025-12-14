-- Create auth_sessions table
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY,
  whatsapp_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- Add comment to explain the table
COMMENT ON TABLE auth_sessions IS 'Temporary storage for authentication sessions, including WhatsApp number association during Google OAuth flow'; 