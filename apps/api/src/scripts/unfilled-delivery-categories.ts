/**
 * Lists Poizon category chains seen by customers that the delivery price
 * table doesn't cover yet (their delivery shows as "уточнит менеджер").
 *
 *   cd /opt/app/apps/api && npx tsx src/scripts/unfilled-delivery-categories.ts
 *
 * Add a profile/rule for each one in modules/pricing/data/delivery-price-table.ts
 * (prices from the RAKETA calculator), then they disappear from this list.
 */
import '../config/load-env';

import { PrismaClient } from '@prisma/client';

import { estimateDeliveryFromTable } from '../modules/pricing/data/delivery-price-table';

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.deliveryCategoryWeight.findMany({
      where: { NOT: { categoryKey: { startsWith: 'enum:' } } },
      orderBy: [{ encounterCount: 'desc' }, { firstSeenAt: 'desc' }],
    });

    const unfilled = rows.filter(
      (row) =>
        row.weightKg === null &&
        !estimateDeliveryFromTable({
          categoryL1: row.categoryL1,
          categoryL2: row.categoryL2,
          categoryL3: row.categoryL3,
        }),
    );

    if (unfilled.length === 0) {
      console.log('All recorded categories are covered by the delivery price table.');
      return;
    }
    console.log(`Unfilled categories: ${unfilled.length}`);
    for (const row of unfilled) {
      console.log(
        `${String(row.encounterCount).padStart(4)}×  ${row.categoryL1 ?? '-'} > ${row.categoryL2 ?? '-'} > ${row.categoryL3 ?? '-'}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
