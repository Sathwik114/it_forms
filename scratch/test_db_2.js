const sql = require('c:/Users/260296/Desktop/operator_resi/node_modules/mssql');

const config = {
  user: 'paydev',
  password: 'dev.gtipay@123',
  server: '10.40.10.105',
  database: 'PayTemp',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function main() {
  try {
    await sql.connect(config);
    console.log('Connected!');

    console.log('Distribution of year/month of DOL for ACTIVE = Y:');
    const result = await sql.query`
      SELECT 
        YEAR(DOL) as Year, 
        MONTH(DOL) as Month, 
        COUNT(*) as Count
      FROM EMPMAST
      WHERE ACTIVE = 'Y' AND DOL IS NOT NULL
      GROUP BY YEAR(DOL), MONTH(DOL)
      ORDER BY Year DESC, Month DESC
    `;
    console.table(result.recordset);

    console.log('Check active count:');
    const activeCount = await sql.query`
      SELECT ACTIVE, COUNT(*) as Count from EMPMAST GROUP BY ACTIVE
    `;
    console.table(activeCount.recordset);

  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    await sql.close();
  }
}

main();
