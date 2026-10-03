import { PrismaClient } from "@prisma/client";

function datasourceUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) return undefined;

  // Prisma 6.0.x cannot establish a connection when Neon URIs include
  // `channel_binding=require`, even though the URI works for the Prisma CLI.
  // TLS remains required through `sslmode=require`.
  return databaseUrl
    .replace(/([?&])channel_binding=[^&]*&?/, "$1")
    .replace(/[?&]$/, "");
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
