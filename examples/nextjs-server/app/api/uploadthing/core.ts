import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  // Profile avatar — images only, small
  avatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  // Post content — images, video, audio, PDF, or any file
  postContent: f({
    image: { maxFileSize: "16MB",  maxFileCount: 1 },
    video: { maxFileSize: "256MB", maxFileCount: 1 },
    audio: { maxFileSize: "64MB",  maxFileCount: 1 },
    pdf:   { maxFileSize: "32MB",  maxFileCount: 1 },
    blob:  { maxFileSize: "64MB",  maxFileCount: 1 },
  })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  // Preview thumbnail for locked content
  preview: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => ({}))
    .onUploadComplete(async ({ file }) => ({ url: file.url })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
