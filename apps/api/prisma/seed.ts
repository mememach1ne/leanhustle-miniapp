import { PrismaClient, SettingsScope, StaffRole } from '@prisma/client';

const prisma = new PrismaClient();

const parseCsv = (value?: string): string[] => {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const zipStaffSeed = (telegramIds: string[], usernames: string[]) => {
  const max = Math.max(telegramIds.length, usernames.length);

  return Array.from({ length: max }, (_, index) => ({
    telegramId: telegramIds[index],
    username: usernames[index]?.replace(/^@/, '') || undefined,
  })).filter((entry) => entry.telegramId || entry.username);
};

async function seedBusinessSettings() {
  await prisma.businessSettings.upsert({
    where: {
      scope: SettingsScope.DEFAULT,
    },
    update: {},
    create: {
      scope: SettingsScope.DEFAULT,
      cnyToUsd: '0.146',
      cnyToRub: '10.9',
      eurToRub: '87.9',
      commissionPercent: '10',
      deliveryPricePerKgRub: '1400',
      dutyThresholdEur: '200',
      dutyPercent: '15',
      dutyProcessingFeeRub: '500',
    },
  });
}

async function seedStaffAccounts() {
  const adminEntries = zipStaffSeed(
    parseCsv(process.env.SEED_ADMIN_TELEGRAM_IDS),
    parseCsv(process.env.SEED_ADMIN_USERNAMES),
  );
  const managerEntries = zipStaffSeed(
    parseCsv(process.env.SEED_MANAGER_TELEGRAM_IDS),
    parseCsv(process.env.SEED_MANAGER_USERNAMES),
  );

  for (const entry of adminEntries) {
    if (!entry.telegramId && !entry.username) {
      continue;
    }

    const existing =
      (entry.telegramId
        ? await prisma.staffAccount.findUnique({
            where: { telegramId: entry.telegramId },
          })
        : null) ??
      (entry.username
        ? await prisma.staffAccount.findUnique({
            where: { username: entry.username },
          })
        : null);

    if (existing) {
      await prisma.staffAccount.update({
        where: { id: existing.id },
        data: {
          telegramId: entry.telegramId ?? existing.telegramId,
          username: entry.username ?? existing.username,
          role: StaffRole.ADMIN,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.staffAccount.create({
      data: {
        telegramId: entry.telegramId,
        username: entry.username,
        role: StaffRole.ADMIN,
      },
    });
  }

  for (const entry of managerEntries) {
    if (!entry.telegramId && !entry.username) {
      continue;
    }

    const existing =
      (entry.telegramId
        ? await prisma.staffAccount.findUnique({
            where: { telegramId: entry.telegramId },
          })
        : null) ??
      (entry.username
        ? await prisma.staffAccount.findUnique({
            where: { username: entry.username },
          })
        : null);

    if (existing) {
      await prisma.staffAccount.update({
        where: { id: existing.id },
        data: {
          telegramId: entry.telegramId ?? existing.telegramId,
          username: entry.username ?? existing.username,
          role: StaffRole.MANAGER,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.staffAccount.create({
      data: {
        telegramId: entry.telegramId,
        username: entry.username,
        role: StaffRole.MANAGER,
      },
    });
  }
}

async function main() {
  await seedBusinessSettings();
  await seedStaffAccounts();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Prisma seed failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
