export function creditsToNano(credits: number): string {
  const rate = parseInt(process.env.CREDITS_PER_TON ?? "100", 10);
  return (BigInt(credits) * BigInt(1_000_000_000) / BigInt(rate)).toString();
}

export function nanoToCredits(nano: string): number {
  const rate = parseInt(process.env.CREDITS_PER_TON ?? "100", 10);
  return Number(BigInt(nano) * BigInt(rate) / BigInt(1_000_000_000));
}
