import { PrismaClient } from "@prisma/client";

function datasourceUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) return undefined;

  // Prisma 6.0.x cannot establish a connection when Neon URIs include
  // `channel_binding=require`, even though the URI works for the Prisma CLI.
  // TLS remains required through `sslmode=require`.
  const url = databaseUrl
    .replace(/([?&])channel_binding=[^&]*&?/, "$1")
    .replace(/[?&]$/, "");

  // Neon suspends the compute endpoint when idle and waking it can take
  // longer than Prisma's default 5s connect timeout, which surfaces as a
  // P1001 "Can't reach database server" error on the first request after
  // idle. Give the handshake enough time to complete the cold start.
  if (/[?&]connect_timeout=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connect_timeout=15`;
}

const prismaClientSingleton = () => {
  const url = datasourceUrl();

  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const db = globalThis.prismaGlobal ?? prismaClientSingleton();

export default db;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = db;
