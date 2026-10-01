import sql from "mssql";

const dbConfig = {
  user: process.env.Serbia_DB_USER,
  password: process.env.Serbia_DB_PASSWORD,
  server: process.env.Serbia_DB_SERVER,       // e.g. "localhost" or "MYSERVER\\SQLEXPRESS"
  database: process.env.Serbia_DB_NAME || "SerbiaDetl",
  port: process.env.Serbia_DB_PORT ? parseInt(process.env.Serbia_DB_PORT, 10) : 1433,
  options: {
    encrypt: process.env.Serbia_DB_ENCRYPT === "true",       // true if using Azure SQL
    trustServerCertificate: true,                       // fine for local/dev SQL Server
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Reuse a single connection pool across requests (important in Next.js dev/hot-reload
// and serverless environments — avoids "already connected" / connection leak errors).
let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .then((pool) => {
        console.log("Connected to SQL Server:", dbConfig.database);
        return pool;
      })
      .catch((err) => {
        poolPromise = null; // allow retry on next call
        throw err;
      });
  }
  return poolPromise;
}

export { sql };