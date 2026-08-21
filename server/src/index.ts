import 'dotenv/config';
import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.SERVER_PORT ?? 4000);

app.listen(port, () => {
  console.log(`Memories API listening on http://localhost:${port}`);
});
