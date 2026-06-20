import mysql from "mysql2/promise";
import type { Pool, QueryResult } from "mysql2/promise";

const connectionLimit = Number(process.env.MYSQL_CONNECTION_LIMIT ?? 3);
const mysqlHost = process.env.MYSQL_HOST ?? process.env.MYSQLHOST ?? "localhost";
const mysqlPort = process.env.MYSQL_PORT ?? process.env.MYSQLPORT ?? 3306;
const mysqlDatabase = process.env.MYSQL_DATABASE ?? process.env.MYSQLDATABASE ?? "sim_pkh";
const mysqlUser = process.env.MYSQL_USER ?? process.env.MYSQLUSER ?? "root";
const mysqlPassword = process.env.MYSQL_PASSWORD ?? process.env.MYSQLPASSWORD ?? "";
const mysqlTarget = process.env.MYSQL_SOCKET_PATH
  ? `socket:${process.env.MYSQL_SOCKET_PATH}`
  : `${mysqlHost}:${mysqlPort}`;

console.info(`[mysql] target=${mysqlTarget} database=${mysqlDatabase} user=${mysqlUser} limit=${connectionLimit}`);

const globalForMysql = globalThis as typeof globalThis & {
  simPkhMysqlPool?: Pool;
};

export const pool = globalForMysql.simPkhMysqlPool ?? mysql.createPool({
  ...(process.env.MYSQL_SOCKET_PATH
    ? { socketPath: process.env.MYSQL_SOCKET_PATH }
    : { host: mysqlHost }),
  port: Number(mysqlPort),
  database: mysqlDatabase,
  user: mysqlUser,
  password: mysqlPassword,
  waitForConnections: true,
  connectionLimit,
  maxIdle: connectionLimit,
  idleTimeout: 30_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000
});

if (process.env.NODE_ENV !== "production") {
  globalForMysql.simPkhMysqlPool = pool;
}

export async function query<T>(sql: string, params: (string | number | boolean | Date | null)[] = []) {
  const [rows] = await executeWithRetry(sql, params);
  return rows as QueryResult as T[];
}

async function executeWithRetry(sql: string, params: (string | number | boolean | Date | null)[]) {
  const delays = [150, 600];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await pool.execute(sql, params);
    } catch (error) {
      if (!isTransientConnectionError(error) || attempt === delays.length) throw error;
      await sleep(delays[attempt]);
    }
  }
  return pool.execute(sql, params);
}

function isTransientConnectionError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  return ["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"].includes(code);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
