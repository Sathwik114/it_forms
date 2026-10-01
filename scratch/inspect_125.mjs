import sql from 'mssql';

const config = {
  user: 'sa',
  password: 'ccise054879+m',
  server: '10.40.10.125',
  database: 'ITForms',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};

async function inspect() {
  const pool = await sql.connect(config);
  
  const tables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE 
    FROM INFORMATION_SCHEMA.TABLES
  `);
  console.log("All tables/views in ITForms:", tables.recordset);

  const empCols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ITFormsEmpMast'
  `);
  console.log("Columns in ITFormsEmpMast:", empCols.recordset);

  const count = await pool.request().query("SELECT COUNT(*) as cnt FROM ITFormsEmpMast");
  console.log("RowCount in ITFormsEmpMast:", count.recordset[0].cnt);

  // Check if UploadedForms table exists
  const formsTable = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UploadedForms'
  `);
  console.log("UploadedForms table exists:", formsTable.recordset.length > 0);

  await pool.close();
  process.exit(0);
}

inspect();

