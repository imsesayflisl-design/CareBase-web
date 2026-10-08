import { PrismaClient } from "@prisma/client";

function normalizeDatasourceUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) return undefined;

  // Prisma 6.0.x cannot establish a connection when Neon URIs include
  // `channel_binding=require`, even though the URI works for the Prisma CLI.
  // TLS remains required through `sslmode=require`.
  let url = databaseUrl
    .replace(/([?&])channel_binding=[^&]*&?/, "$1")
    .replace(/[?&]$/, "");

  const hasParam = (name: string) => new RegExp(`[?&]${name}=`).test(url);
  const addParam = (name: string, value: string) => {
    if (hasParam(name)) return;
    url += `${url.includes("?") ? "&" : "?"}${name}=${value}`;
  };

  const isPooledHost = /pooler/i.test(url);

  // Neon suspends the compute endpoint when idle and waking it can take
  // longer than Prisma's default 5s connect timeout, which surfaces as a
  // P1001 "Can't reach database server" error on the first request after
  // idle. Give the handshake enough time to complete the cold start.
  addParam("connect_timeout", "15");

  if (isPooledHost) {
    // The DATABASE_URL points at Neon's PgBouncer pooler. Prisma must be
    // told about it, otherwise it keeps its own pool of ~9 physical
    // connections per client (num_cpus * 2 + 1) and quickly exhausts the
    // pool with "Timed out fetching a new connection from the connection
    // pool" (P2024). Transaction mode + a small client-side pool fixes it.
    // NOTE: limit must stay >= the widest Promise.all fan-out in the app
    // (pages fire 5-8 queries concurrently). `1` starves them: every query
    // beyond the first queues until pool_timeout and throws P2024.
    // The globalThis singleton below guarantees a single client per server
    // process, so 10 physical connections max is safe for Neon's pooler.
    // See http://pris.ly/d/connection-pool
    addParam("pgbouncer", "true");
    if (!hasParam("connection_limit")) addParam("connection_limit", "10");
    if (!hasParam("pool_timeout")) addParam("pool_timeout", "30");
  } else {
    if (!hasParam("connection_limit")) addParam("connection_limit", "5");
    if (!hasParam("pool_timeout")) addParam("pool_timeout", "10");
  }

  return url;
}

const prismaClientSingleton = () => {
  const url = normalizeDatasourceUrl();
  if (url) {
    // Prisma 6 removed the `datasources` constructor override, so publish the
    // normalized URL (channel_binding stripped, pgbouncer flags added) back
    // to the env before constructing the client.
    process.env.DATABASE_URL = url;
  }

  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
} & typeof global;

const db = globalThis.prismaGlobal ?? prismaClientSingleton();

// Always cache on globalThis — not just in development. In production
// serverless / multi-worker setups each new client multiplies the number of
// physical connections against the pool, which is exactly what triggers
// P2024 pool timeouts. Reuse the same client across HMR reloads and
// invocations.
if (!globalThis.prismaGlobal) globalThis.prismaGlobal = db;

export default db;

