# WhatsApp AI Bot 🤖

A ChatGPT-powered WhatsApp bot that responds with **friendly pidgin/English mix**. The bot remembers user names, stores conversation history, and prevents bot loops.

## ✨ Features

- 🤖 ChatGPT integration with conversation memory
- 💬 Speaks pidgin English + regular English naturally
- 👋 Remembers user names and greets them when they return
- 📝 Stores full conversation history per user
- 🔄 Auto-reconnection on disconnect
- 🔒 Secure QR code authentication
- ⏱️ Typing indicators for realistic feel
- 🚫 **Loop prevention** - Bot ignores its own messages
- 📱 Only responds to incoming messages (not to itself)

## Setup

### 1. Get Your OpenAI API Key
- Go to https://platform.openai.com/api-keys
- Create a new API key and copy it

### 2. Set Environment Variables
Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your-api-key-here
BOT_NUMBER=2349031646071@s.whatsapp.net
```

Or set them in PowerShell before running:
```powershell
$env:OPENAI_API_KEY = "sk-your-key"
$env:BOT_NUMBER = "2349031646071@s.whatsapp.net"
npm start
```

### 3. Run the Bot
```bash
npm start
```

The bot will display a QR code in the terminal. Scan it with your WhatsApp to authenticate.

## How It Works

1. **Direct Messages** - Bot responds to all messages from individuals
2. **Group Messages** - Bot only responds when tagged/mentioned with the bot number
3. **Recognizes user** - Extracts name if provided ("I'm John", "call me Ade")
4. **Stores memory** - Saves name and conversation history in `users.json`
5. **Generates response** - Uses OpenAI with full conversation context
6. **Sends reply** - Speaks in friendly pidgin/English mix
7. **Greets returning users** - "Ah, welcome back! 😊"

## 📱 Direct Messages vs Group Messages

### Direct Chat
- ✅ Bot responds to all messages
- ✅ Remembers user name
- ✅ Friendly conversation

### Group Chat
- ⚠️ Bot only responds when **tagged/mentioned**
- ⚠️ Prevents chaos in groups
- ✅ Still remembers names and stores history
- ✅ Can use commands (owner only)

**Example in Group:**
```
User A: hey guys
(Bot doesn't respond)

User B: @2349031646071 how are you?
(Bot responds!)
```

## Example Conversations

### First time user:
```
User: Hi, I'm Chioma
Bot: Ah ah! Welcome abeg! 👋 You fine Chioma? Abi wetin do you? E be like you come here for the first time, welcome aboard! 🎉
```

### Returning user:
```
User: Hey again
Bot: Eyyy Chioma! 😊 Welcome back! How body? I don miss you o! Wetin do you today?
```

## Configuration

### The Bot's WhatsApp Number
Set this to the number where the bot is deployed:
```env
BOT_NUMBER=2349031646071@s.whatsapp.net
```

The bot will:
- ✅ Respond to all messages received on this number
- ❌ Never respond to messages from this number (prevents loops)
- 📝 Store information about who messages it

## User Data Storage

All user information is stored in `users.json`:
```json
{
  "2349012345678@s.whatsapp.net": {
    "name": "Chioma",
    "firstTime": false,
    "conversationHistory": [
      {"role": "user", "content": "Hi I'm Chioma"},
      {"role": "assistant", "content": "Ah ah! Welcome..."}
    ],
    "lastSeen": "2024-05-11T10:30:00.000Z"
  }
}
```

## Pidgin/English Mix

The bot naturally speaks like this:
- "Abeg" = Please
- "No be like that" = That's not how it is
- "Chai!" = Expression of surprise
- "Fine girl/guy" = Beautiful person
- "E be like" = It seems like
- "Wetin do you?" = What's up with you?
- "Body?" = How are you?
- "Make we" = Let's
- "Abi" = Or is it

## Troubleshooting

### Bot not responding
- Check if you've scanned the QR code ✅
- Verify OpenAI API key is valid
- Check console for errors
- Make sure `BOT_NUMBER` is correct

### "OPENAI_API_KEY not set"
```powershell
$env:OPENAI_API_KEY = "sk-your-key"
```

### Bot creating loops
- ✅ Already fixed! Bot ignores its own messages

### Users.json keeps growing
- Normal - it stores all conversation history
- You can manually delete old entries to clear space

## Development

```bash
# Install dependencies
npm install

# Start bot
npm start

# Stop bot
Ctrl + C
```

## License
ISC
