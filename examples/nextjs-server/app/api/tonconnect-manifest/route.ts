export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const manifest = {
    url: appUrl,
    name: "Ribbit",
    iconUrl: `${appUrl}/logo-text-white.png`,
  };

  return Response.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
