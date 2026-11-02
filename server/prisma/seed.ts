import { runDatabaseSeed } from '../src/routes/seed.routes.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('🌱 Starting database seed...');
  const summary = await runDatabaseSeed();
  console.log('✅ Seed finished successfully!');
  console.log(`- Created ${summary.usersCount} users`);
  console.log(`- Created ${summary.projectsCount} projects`);
  console.log(`- Created ${summary.tasksCount} tasks`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
