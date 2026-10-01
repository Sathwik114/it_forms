const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: 'paydev',
  password: 'dev.gtipay@123',
  server: '10.40.10.105',
  database: 'PayTemp',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
  }
};

async function test() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log('Connected to PayTemp!');
    
    // Check all databases
    const dbs = await pool.request().query('SELECT name FROM sys.databases');
    console.log('Databases:', dbs.recordset.map(d => d.name));

    // Find tables matching 'payroll' or 'emp' or 'user'
    const tables = await pool.request().query(
      "SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%payroll%' OR TABLE_NAME LIKE '%emp%'"
    );
    console.log('Matching tables:', tables.recordset);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

test();
