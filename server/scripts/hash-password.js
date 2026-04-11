import { crearHashPassword } from '../utils/password.js';

const password = process.argv[2];

if (!password) {
  console.error('Uso: npm run admin:hash -- "tu-clave"');
  process.exit(1);
}

console.log(crearHashPassword(password));
