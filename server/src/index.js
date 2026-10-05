import 'dotenv/config';
import { createApp } from './app.js';
import { ROLES } from './data/store.js';

const PORT = Number(process.env.PORT) || 4000;

createApp().listen(PORT, () => {
  console.log(`[server] Restaurant Ops API listening on http://localhost:${PORT}`);
  console.log(`[server] Roles: ${ROLES.join(', ')}`);
});
