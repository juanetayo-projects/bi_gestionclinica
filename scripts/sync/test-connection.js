'use strict';
// Prueba rápida de conexión a GoMedisys (solo lectura)
// Uso: node --env-file=.env test-connection.js

const sql = require('mssql');

async function main() {
  const pool = await sql.connect({
    server:   process.env.GOMEDISYS_HOST,
    port:     parseInt(process.env.GOMEDISYS_PORT || '1433', 10),
    database: process.env.GOMEDISYS_DATABASE,
    user:     process.env.GOMEDISYS_USERNAME,
    password: process.env.GOMEDISYS_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30_000 },
  });
  const r = await pool.request().query(`
    SELECT
      DB_NAME() AS base,
      (SELECT COUNT(*) FROM encounters WHERE idUserCompany = 108240) AS encuentros_empresa,
      (SELECT COUNT(*) FROM userConfAdministrativeSex) AS catalogo_sexo
  `);
  console.log('CONEXION OK:', JSON.stringify(r.recordset[0]));
  await pool.close();
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
