# Testing Ribbit in Telegram

## Prerequisites
- Telegram account
- Tonkeeper app installed (for TON payments)

## Step 1: Get a public HTTPS URL

Install ngrok:
```bash
brew install ngrok/ngrok/ngrok
```

Expose your local dev server:
```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`).
Update `NEXT_PUBLIC_APP_URL` in `.env` with this URL.

## Step 2: Create a Telegram Bot

1. Open Telegram and message `@BotFather`
2. Send `/newbot`, follow the prompts
3. Copy the bot token → set `TELEGRAM_BOT_TOKEN` in `.env`

## Step 3: Set Up the Mini App

In BotFather:
1. Send `/newapp`
2. Choose your bot
3. Enter app name: `Ribbit`
4. Upload an icon (512x512 PNG)
5. Set Web App URL to your ngrok HTTPS URL
6. BotFather gives you an app link like `t.me/YourBot/ribbit`

## Step 4: Set Webhook (for Stars payments)

```bash
curl -X POST "https://api.telegram.org/bot{YOUR_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_NGROK_URL/api/telegram-webhook"}'
```

## Step 5: Restart and Test

```bash
pnpm dev
```

Open `t.me/YourBot/ribbit` in Telegram on your phone.

## Testing Payments

For TON payments:
- Install Tonkeeper, enable testnet mode (Settings → Dev Tools → Switch to testnet)
- Get testnet TON from https://testnet.toncenter.com/

For Stars (test mode):
- Stars invoices work with real Stars in the Telegram test environment
- Use Telegram's test DC accounts for full testing

## Notes
- The app works in browser at `http://localhost:3000` without Telegram auth (dev mode)
- All API calls are authenticated automatically when opened inside Telegram
- The back button is native (Telegram handles it via SDK)

- go to: https://noncaffeinic-unodorously-valentin.ngrok-free.dev/api/setup-webhook if restart ngrok
