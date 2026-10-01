import sql from "mssql";

const dbConfig = {
  user: process.env.Serbia_DB_USER || "paydev",
  password: process.env.Serbia_DB_PASSWORD || "dev.gtipay@123",
  server: process.env.Serbia_DB_SERVER || "10.40.10.105",
  database: "ITForms",
  port: parseInt(process.env.Serbia_DB_PORT || "1433", 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise = null;

export function getITFormsPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .then((pool) => {
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error("ITForms Database Connection Failed: ", err);
        throw err;
      });
  }
  return poolPromise;
}

export { sql };
