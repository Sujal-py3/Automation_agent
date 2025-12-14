-- Add WhatsApp number column to users table
ALTER TABLE users ADD COLUMN whatsapp_number TEXT;

-- Create index for faster lookups
CREATE INDEX idx_users_whatsapp_number ON users(whatsapp_number);

-- Add comment to explain the column
COMMENT ON COLUMN users.whatsapp_number IS 'The WhatsApp number associated with this user, in E.164 format (e.g., +1234567890)'; 