import EmbeddedPostgres from 'embedded-postgres';

const command = process.argv[2] ?? 'up';
const dataDir = process.cwd() + '/.pgdata';

async function up() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'dayflow',
    password: 'dayflow',
    port: 5432,
    persistent: true
  });

  const fs = await import('fs');
  const alreadyInit = fs.existsSync(dataDir + '/PG_VERSION');
  if (!alreadyInit) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase('dayflow');
  } catch {
    console.log('database dayflow already exists');
  }
  console.log('EMBEDDED_POSTGRES_READY');
  setInterval(() => undefined, 60_000);
}

async function down() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'dayflow',
    password: 'dayflow',
    port: 5432,
    persistent: true
  });
  await pg.stop();
  console.log('EMBEDDED_POSTGRES_STOPPED');
}

if (command === 'down') {
  await down();
} else {
  await up();
}
