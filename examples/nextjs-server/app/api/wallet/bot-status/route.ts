export async function GET() {
  return Response.json({ configured: !!process.env.TELEGRAM_BOT_TOKEN });
}
