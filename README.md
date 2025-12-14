# ALF.RED - WhatsApp AI Assistant

ALF.RED is an AI-powered assistant that works entirely through WhatsApp, helping you manage emails, set reminders, and automate tasks.

## Features

- 📧 **Send Emails**: Compose and send professional emails through WhatsApp
- ⏰ **Set Reminders**: Schedule reminders and notifications (coming soon)
- 📩 **Reply to Emails**: Reply to existing emails (coming soon)
- ✍️ **Custom Tasks**: Handle various automation tasks (coming soon)

## How It Works

### 1. Initial Setup
- Send "Hi", "Hello", or "Hey" to ALF.RED on WhatsApp
- You'll receive a welcome message with menu options

### 2. Email Composition Flow
1. **Greet**: Send "Hi" → Get menu options
2. **Choose**: Select option 1 (Send Email)
3. **Recipient**: Provide the email address
4. **Purpose**: Describe what you want to say in natural language
5. **Review**: ALF.RED generates a professional email draft
6. **Confirm**: Reply with "Send", "Cancel", or "Edit"

### Example Flow
```
You: Hi
ALF.RED: 🎉 Hi there! Welcome to ALF.RED!
         What would you like to do?
         1. 📨 Send Email
         2. ⏰ Set Reminder
         3. 📩 Reply to Email
         4. ✍️ Custom Task
         5. 🔄 Reset Session

You: 1
ALF.RED: 📧 Let's compose your email!
         Please provide the recipient's email address:

You: john@example.com
ALF.RED: ✅ Great! Now tell me the purpose of this email in natural language.
         For example:
         • 'ask them about their health'
         • 'follow up on the meeting'
         • 'send them the project update'

You: ask them about their health
ALF.RED: ⏳ Generating your email draft...
         📧 **Email Draft Generated**
         **To**: john@example.com
         **Subject**: Checking In On Your Wellbeing
         **Body**:
         Hi John,
         I just wanted to check in and see how you're doing. I hope your health is in great shape and you're feeling well. Let me know if there's anything you need.
         Warm regards,
         [Your Name]

         Reply with:
         ✅ "Send" - to send the email
         ❌ "Cancel" - to cancel
         ✏️ "Edit" - to modify the draft

You: Send
ALF.RED: ✅ Email sent successfully!
         📧 To: john@example.com
         📝 Subject: Checking In On Your Wellbeing
         Send "Hi" to compose another email or try other features!
```

## Technical Details

- **Backend**: NestJS with TypeScript
- **Database**: Supabase (PostgreSQL)
- **WhatsApp Integration**: Twilio
- **Email Service**: Gmail API
- **AI**: OpenAI GPT for email generation

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Build the application: `npm run build`
5. Start the server: `npm start`

## Environment Variables

Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `OPENAI_API_KEY`

## Architecture

The application is designed to work entirely through WhatsApp:

1. **WhatsApp Service**: Handles all incoming messages and manages conversation flow
2. **Email Drafter**: Generates professional email drafts using AI
3. **Gmail Service**: Sends emails through Gmail API
4. **Authentication**: Google OAuth for Gmail access
5. **Database**: Stores user data and session information

## Session Management

The app maintains conversation sessions to handle multi-step processes:
- Email composition (recipient → purpose → draft → confirmation)
- Draft editing (subject, body, recipient, purpose)
- Menu navigation

All sessions are stored in memory and reset after completion or timeout. 