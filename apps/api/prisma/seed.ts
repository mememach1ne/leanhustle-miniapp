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

async function upsertStaffEntry(
  entry: { telegramId?: string; username?: string },
  role: StaffRole,
): Promise<string | null> {
  if (!entry.telegramId && !entry.username) return null;

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
        role,
        isActive: true,
      },
    });
    return existing.id;
  }

  const created = await prisma.staffAccount.create({
    data: {
      telegramId: entry.telegramId,
      username: entry.username,
      role,
    },
  });
  return created.id;
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

  const allowedIds = new Set<string>();

  for (const entry of adminEntries) {
    const id = await upsertStaffEntry(entry, StaffRole.ADMIN);
    if (id) allowedIds.add(id);
  }

  for (const entry of managerEntries) {
    const id = await upsertStaffEntry(entry, StaffRole.MANAGER);
    if (id) allowedIds.add(id);
  }

  // Anyone NOT in the env lists gets deactivated so they lose staff
  // access. We don't hard-delete to preserve audit trails / FKs.
  const deactivated = await prisma.staffAccount.updateMany({
    where: {
      isActive: true,
      id: { notIn: [...allowedIds] },
    },
    data: { isActive: false },
  });

  if (deactivated.count > 0) {
    console.log(`[seed] deactivated ${deactivated.count} staff not in env lists`);
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
