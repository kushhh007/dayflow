import app from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`dayflow backend listening on port ${env.PORT}`);
});
