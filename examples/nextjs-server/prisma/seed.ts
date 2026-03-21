import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbUrl = `file:${path.join(__dirname, "dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const creator1 = await prisma.creator.upsert({
    where: { telegramUserId: "111111111" },
    update: {},
    create: {
      telegramUserId: "111111111",
      telegramUsername: "pixel_picasso",
      displayName: "PixelPicasso",
      bio: "Digital art, generative pieces, and exclusive behind-the-scenes content.",
      avatarUrl: "https://i.pravatar.cc/150?img=3",
      walletAddress: "EQDummyAddress1",
    },
  });

  await prisma.subscriptionTier.upsert({
    where: { id: "tier-supporter" },
    update: {},
    create: {
      id: "tier-supporter",
      creatorId: creator1.id,
      name: "Supporter",
      creditsPerMonth: 50,
      description: "Access to subscriber-only posts and early previews",
      perks: JSON.stringify(["Early access", "HD downloads", "Discord role"]),
    },
  });

  await prisma.subscriptionTier.upsert({
    where: { id: "tier-superfan" },
    update: {},
    create: {
      id: "tier-superfan",
      creatorId: creator1.id,
      name: "Superfan",
      creditsPerMonth: 150,
      description: "Everything in Supporter plus monthly 1-on-1 chat",
      perks: JSON.stringify(["All Supporter perks", "Monthly call", "Custom art commission"]),
    },
  });

  await prisma.post.upsert({
    where: { id: "post-1" },
    update: {},
    create: {
      id: "post-1",
      creatorId: creator1.id,
      title: "Sunrise Over the Blockchain",
      description: "A generative art piece created using TON transaction hashes as seeds.",
      contentType: "IMAGE",
      contentUrl: "https://picsum.photos/seed/ribbit-full/800/600",
      previewUrl: "https://picsum.photos/seed/ribbit1/400/300",
      accessType: "ONE_TIME_UNLOCK",
      creditPrice: 10,
      publishedAt: new Date(),
    },
  });

  await prisma.post.upsert({
    where: { id: "post-2" },
    update: {},
    create: {
      id: "post-2",
      creatorId: creator1.id,
      title: "Community Mural — Group Unlock",
      description: "If 5 people unlock this, it becomes free for everyone! Join the community art piece.",
      contentType: "IMAGE",
      contentUrl: "https://picsum.photos/seed/ribbit-mural/800/600",
      previewUrl: "https://picsum.photos/seed/ribbit2/400/300",
      accessType: "GROUP_UNLOCK",
      creditPrice: 5,
      groupUnlockTarget: 5,
      groupUnlockCurrent: 2,
      publishedAt: new Date(),
    },
  });

  await prisma.post.upsert({
    where: { id: "post-3" },
    update: {},
    create: {
      id: "post-3",
      creatorId: creator1.id,
      title: "Behind the Scenes: My Creative Process",
      description: "A deep dive into how I create digital art using blockchain data.",
      contentType: "TEXT",
      contentUrl: "https://example.com/exclusive-text-content",
      accessType: "SUBSCRIBERS_ONLY",
      creditPrice: 0,
      publishedAt: new Date(),
    },
  });

  const creator2 = await prisma.creator.upsert({
    where: { telegramUserId: "222222222" },
    update: {},
    create: {
      telegramUserId: "222222222",
      telegramUsername: "ton_beats",
      displayName: "TON Beats",
      bio: "Electronic music produced on-chain. Every track is unique.",
      avatarUrl: "https://i.pravatar.cc/150?img=8",
      walletAddress: "EQDummyAddress2",
    },
  });

  await prisma.subscriptionTier.upsert({
    where: { id: "tier-fan" },
    update: {},
    create: {
      id: "tier-fan",
      creatorId: creator2.id,
      name: "Fan",
      creditsPerMonth: 30,
      description: "Access to all music posts",
      perks: JSON.stringify(["All tracks", "Stems download"]),
    },
  });

  await prisma.post.upsert({
    where: { id: "post-4" },
    update: {},
    create: {
      id: "post-4",
      creatorId: creator2.id,
      title: "Genesis Track — Free Preview",
      description: "My first track made entirely from TON block hashes. Free to listen!",
      contentType: "AUDIO",
      contentUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      accessType: "FREE",
      creditPrice: 0,
      publishedAt: new Date(),
    },
  });

  await prisma.post.upsert({
    where: { id: "post-5" },
    update: {},
    create: {
      id: "post-5",
      creatorId: creator2.id,
      title: "Blockchain Beats Vol. 2 (Exclusive)",
      description: "The full album, unlockable for fans.",
      contentType: "AUDIO",
      contentUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      previewUrl: "https://picsum.photos/seed/album-art/400/400",
      accessType: "ONE_TIME_UNLOCK",
      creditPrice: 25,
      publishedAt: new Date(),
    },
  });

  // Dev user wallet with starter credits
  await prisma.userWallet.upsert({
    where: { telegramUserId: "dev-user-123" },
    update: {},
    create: { telegramUserId: "dev-user-123", creditBalance: 500 },
  });

  console.log("Seed complete. 2 creators, 5 posts, 3 tiers.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
