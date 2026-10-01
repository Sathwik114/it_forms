import sql from 'mssql';

const config = {
  user: 'sa',
  password: 'ccise054879+m',
  server: '10.40.10.125',
  database: 'master',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
  }
};

async function testConnection() {
  console.log("Attempting connection to 10.40.10.125:1433...");
  try {
    const pool = await sql.connect(config);
    console.log("Successfully connected to 10.40.10.125 master database!");
    
    // Check if ITForms database exists
    const dbs = await pool.request().query("SELECT name FROM sys.databases WHERE name = 'ITForms'");
    console.log("Databases matching ITForms:", dbs.recordset);

    if (dbs.recordset.length === 0) {
      console.log("Database ITForms does not exist on 10.40.10.125. Creating it now...");
      await pool.request().query("CREATE DATABASE ITForms");
      console.log("Database ITForms created successfully on 10.40.10.125!");
    } else {
      console.log("Database ITForms already exists on 10.40.10.125.");
    }

    await pool.close();

    // Now connect directly to ITForms
    const itFormsConfig = { ...config, database: 'ITForms' };
    const itFormsPool = await sql.connect(itFormsConfig);
    console.log("Successfully connected directly to ITForms on 10.40.10.125!");

    const tables = await itFormsPool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    console.log("Tables in ITForms:", tables.recordset);

    await itFormsPool.close();
    process.exit(0);
  } catch (err) {
    console.error("Connection failed:", err);
    process.exit(1);
  }
}

testConnection();

