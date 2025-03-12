# ColourStream Upload Monitoring with Telegram

This document explains how to set up and use the Telegram bot for monitoring tusd uploads in real-time.

## Overview

The Telegram integration allows you to:

1. Receive real-time notifications about upload progress
2. Get alerts when uploads complete
3. Monitor all active uploads in your system
4. See detailed information about each upload including file size, progress percentage, and metadata

## Setup Instructions

### 1. Create a Telegram Bot

1. Open Telegram and search for the "BotFather" (@BotFather)
2. Start a chat with BotFather and send the command `/newbot`
3. Follow the instructions to create a new bot:
   - Provide a name for your bot (e.g., "ColourStream Upload Monitor")
   - Provide a username for your bot (must end with "bot", e.g., "colourstream_upload_bot")
4. BotFather will give you a token for your new bot. Save this token as you'll need it later.

### 2. Create a Group or Channel for Notifications

You have two options:
- **Private Chat**: You can receive notifications directly in a private chat with the bot
- **Group**: You can create a group and add the bot to it (recommended for team monitoring)

For a group:
1. Create a new group in Telegram
2. Add your bot to the group
3. Make the bot an admin (optional but recommended)

### 3. Get the Chat ID

#### For a Private Chat:
1. Start a chat with your bot
2. Send any message to the bot
3. Open a browser and go to: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   (replace `<YOUR_BOT_TOKEN>` with your actual bot token)
4. Look for the `"chat":{"id":123456789}` value in the response. This number is your chat ID.

#### For a Group:
1. Add the bot @RawDataBot to your group
2. The bot will send a message with group information including the chat ID
3. Remove @RawDataBot from the group after getting the ID

### 4. Configure Environment Variables

Add the following variables to your `.env` file:

```
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### 5. Configure tusd Hooks

Make sure tusd is configured to send hooks to your backend. Add the following to your tusd configuration:

```
--hooks-http=http://your-backend-url/api/tusd-hooks
```

Or if using Docker, add to your tusd service in docker-compose.yml:

```yaml
tusd:
  # ... other configuration
  command:
    - "-hooks-http=http://backend:3000/api/tusd-hooks"
    # ... other tusd options
```

## Usage

Once set up, the Telegram bot will automatically:

1. Send a notification when the system starts up
2. Send notifications when new uploads begin
3. Send progress updates during uploads
4. Send completion notifications when uploads finish

## Customizing Notifications

You can customize the notification frequency and content by modifying the following files:

- `backend/src/services/uploads/uploadTracker.ts` - Controls how often updates are sent
- `backend/src/services/telegram/telegramBot.ts` - Controls the format and content of messages

## Troubleshooting

If you're not receiving notifications:

1. Check that `TELEGRAM_ENABLED` is set to `true` in your environment
2. Verify your bot token and chat ID are correct
3. Make sure the bot has permission to send messages in the chat
4. Check your backend logs for any Telegram-related errors
5. Ensure tusd is correctly configured to send hooks to your backend

## Security Considerations

- Keep your bot token secure as it can be used to control your bot
- Consider using a dedicated chat/group for notifications to avoid mixing with other communications
- The bot does not have access to the actual file contents, only metadata about the uploads 