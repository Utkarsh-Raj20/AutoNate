import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  const executions = await prisma.execution.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5,
    include: {
      workflow: {
        select: { name: true }
      }
    }
  });

  console.log(JSON.stringify(executions, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
