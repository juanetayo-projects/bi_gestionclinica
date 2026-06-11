'use strict';
// Restablece la contraseña de un usuario (GoTrue Admin API, service key)
// Uso: node --env-file=.env reset-password.js <user_id> <nueva_contraseña>

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const [userId, password] = process.argv.slice(2);
  if (!userId || !password) {
    console.error('Uso: node --env-file=.env reset-password.js <user_id> <nueva_contraseña>');
    process.exit(1);
  }

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);

  console.log(`Contraseña actualizada para ${data.user?.email}`);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
