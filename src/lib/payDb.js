import sql from "mssql";

const dbConfig = {
  user: "paydev",
  password: "dev.gtipay@123",
  server: "10.40.10.105",
  database: "PayTemp",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise = null;

export function getPayPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .then((pool) => {
        console.log("PayTemp MSSQL connected successfully!");
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error("PayTemp Database Connection Failed: ", err);
        throw err;
      });
  }
  return poolPromise;
}

export { sql };
