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

    const result = await sql.query`
      SELECT TOP 5 EMPCODE, EMPNAME, DESIG, DEPTCODE, NSECCODE, JOINDATE, DOL, LASTWRKDAY, REASON
      FROM EMPMAST
      WHERE ACTIVE = 'Y' AND YEAR(DOL) = 2026 AND MONTH(DOL) = 7
    `;
    console.table(result.recordset);

  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    await sql.close();
  }
}

main();
