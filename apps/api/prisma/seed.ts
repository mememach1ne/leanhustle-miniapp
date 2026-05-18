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

// Hardcoded delivery category catalog. Mirrors the keyword classifier in
// product-category-classifier.service.ts so the manager can review/edit
// every known category from the bot. The "categoryKey" uses an "enum:"
// prefix to avoid collisions with dynamic L1|L2|L3 chains.
const KNOWN_DELIVERY_CATEGORIES: Array<{
  key: string;
  title: string;
  weightKg: number;
}> = [
  // Footwear
  { key: 'enum:SNEAKERS', title: 'Кроссовки', weightKg: 1.8 },
  { key: 'enum:SLIDES', title: 'Сланцы / сандалии', weightKg: 1.1 },
  { key: 'enum:BOOTS', title: 'Ботинки', weightKg: 2.2 },
  { key: 'enum:LOAFERS', title: 'Лоферы / мокасины', weightKg: 1.4 },
  // Apparel
  { key: 'enum:TSHIRT', title: 'Футболка / поло', weightKg: 0.4 },
  { key: 'enum:SHORTS', title: 'Шорты', weightKg: 0.5 },
  { key: 'enum:PANTS', title: 'Брюки / джинсы', weightKg: 0.8 },
  { key: 'enum:HOODIE', title: 'Худи', weightKg: 1.0 },
  { key: 'enum:SWEATSHIRT', title: 'Свитшот', weightKg: 0.9 },
  { key: 'enum:JACKET', title: 'Куртка / пуховик', weightKg: 1.4 },
  { key: 'enum:VEST', title: 'Жилет', weightKg: 0.6 },
  { key: 'enum:DRESS', title: 'Платье', weightKg: 0.7 },
  { key: 'enum:SKIRT', title: 'Юбка', weightKg: 0.5 },
  { key: 'enum:UNDERWEAR', title: 'Бельё / носки', weightKg: 0.2 },
  // Accessories
  { key: 'enum:WATCH', title: 'Часы', weightKg: 0.3 },
  { key: 'enum:GLASSES', title: 'Очки', weightKg: 0.25 },
  { key: 'enum:BAG', title: 'Сумка / рюкзак', weightKg: 1.2 },
  { key: 'enum:SMALL_ACCESSORY', title: 'Кошелёк / ремень', weightKg: 0.2 },
  { key: 'enum:JEWELRY', title: 'Украшения', weightKg: 0.15 },
  { key: 'enum:PHONE_CASE', title: 'Чехол для телефона', weightKg: 0.15 },
  { key: 'enum:HEADWEAR', title: 'Кепка / шапка', weightKg: 0.25 },
  { key: 'enum:SCARF', title: 'Шарф / платок', weightKg: 0.3 },
  { key: 'enum:PERFUME', title: 'Парфюм', weightKg: 0.5 },
  { key: 'enum:TECH_ACCESSORY', title: 'Наушники / техника', weightKg: 0.4 },
];

async function seedDeliveryCategories() {
  for (const item of KNOWN_DELIVERY_CATEGORIES) {
    await prisma.deliveryCategoryWeight.upsert({
      where: { categoryKey: item.key },
      // Don't override the manager's edits on re-run — only create if missing.
      update: {},
      create: {
        categoryKey: item.key,
        categoryL1: null,
        categoryL2: null,
        categoryL3: null,
        title: item.title,
        weightKg: item.weightKg.toString(),
        encounterCount: 0,
      },
    });
  }
}

async function main() {
  await seedBusinessSettings();
  await seedStaffAccounts();
  await seedDeliveryCategories();
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
