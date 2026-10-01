const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.Serbia_DB_USER || 'paydev',
  password: process.env.Serbia_DB_PASSWORD || 'dev.gtipay@123',
  server: process.env.Serbia_DB_SERVER || '10.40.10.105',
  database: process.env.Serbia_DB_NAME || 'SerbiaDetl',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
  }
};

async function test() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log('Connected to SerbiaDetl!');
    
    const result = await pool.request().query('SELECT TOP 1 * FROM ResignLoginMast');
    console.log('Columns in ResignLoginMast:', Object.keys(result.recordset[0]));
    console.log('Sample record:', result.recordset[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

test();
