import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pluto.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Administrator',
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create sample session
  const session = await prisma.session.upsert({
    where: { code: 'DEMO01' },
    update: {},
    create: {
      title: 'Welcome to Pluto',
      code: 'DEMO01',
      adminId: admin.id,
      backgroundType: 'color',
      themeConfig: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        background: '#1e293b',
        text: '#f1f5f9',
        chatOverlay: 'rgba(15,23,42,0.9)',
        fontFamily: 'Inter',
        fontSize: '16',
        chatPosition: 'right',
      },
    },
  });

  console.log('✅ Sample session created:', session.code);

  // Create sample media assets (stickers)
  const stickers = [
    { filename: 'thumbs-up.png', url: '/stickers/thumbs-up.png' },
    { filename: 'heart.png', url: '/stickers/heart.png' },
    { filename: 'clap.png', url: '/stickers/clap.png' },
    { filename: 'fire.png', url: '/stickers/fire.png' },
  ];

  for (const sticker of stickers) {
    const exists = await prisma.mediaAsset.findFirst({ where: { url: sticker.url } });
    if (!exists) {
      await prisma.mediaAsset.create({
        data: {
          type: 'STICKER',
          url: sticker.url,
          filename: sticker.filename,
          mimeType: 'image/png',
          size: 1024,
          uploadedBy: admin.id,
        },
      });
    }
  }

  console.log('✅ Sample stickers created');
  console.log('\n🎉 Seed completed successfully!');
  console.log(`\n📧 Admin Email: ${adminEmail}`);
  console.log(`🔑 Admin Password: ${adminPassword}`);
  console.log(`🎯 Sample Session Code: ${session.code}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
