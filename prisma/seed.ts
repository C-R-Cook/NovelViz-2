import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { BookStatus, PrismaClient, UserRole } from "@db";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const books = [
  {
    title: "Dracula",
    author: "Bram Stoker",
    description:
      "A Gothic horror classic: Jonathan Harker’s journey to Transylvania and Count Dracula’s arrival in England.",
    genre: "Gothic horror",
    publishedYear: 1897,
    coverImageUrl: "https://picsum.photos/400/600?random=1",
  },
  {
    title: "Treasure Island",
    author: "Robert Louis Stevenson",
    description:
      "Young Jim Hawkins finds a treasure map and sails into mutiny, pirates, and adventure on the Spanish Main.",
    genre: "Adventure",
    publishedYear: 1883,
    coverImageUrl: "https://picsum.photos/400/600?random=2",
  },
  {
    title: "Pride and Prejudice",
    author: "Jane Austen",
    description:
      "Elizabeth Bennet and Mr. Darcy navigate manners, misunderstanding, and marriage in Regency England.",
    genre: "Romance",
    publishedYear: 1813,
    coverImageUrl: "https://picsum.photos/400/600?random=3",
  },
  {
    title: "The Time Machine",
    author: "H. G. Wells",
    description:
      "An inventor travels far into the future and witnesses the fate of humanity in this foundational science fiction tale.",
    genre: "Science fiction",
    publishedYear: 1895,
    coverImageUrl: "https://picsum.photos/400/600?random=4",
  },
  {
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    description:
      "Twelve stories of deduction and intrigue featuring the world’s most famous consulting detective.",
    genre: "Mystery",
    publishedYear: 1892,
    coverImageUrl: "https://picsum.photos/400/600?random=5",
  },
  {
    title: "Frankenstein",
    author: "Mary Shelley",
    description:
      "Victor Frankenstein’s experiment and its terrible consequences—a landmark of Gothic and science fiction.",
    genre: "Gothic",
    publishedYear: 1818,
    coverImageUrl: "https://picsum.photos/400/600?random=6",
  },
  {
    title: "Around the World in Eighty Days",
    author: "Jules Verne",
    description:
      "Phileas Fogg wagers he can circle the globe in eighty days—rail, steamship, and comic misadventure ensue.",
    genre: "Adventure",
    publishedYear: 1873,
    coverImageUrl: "https://picsum.photos/400/600?random=7",
  },
  {
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    description:
      "An orphaned governess finds independence, love, and secrets at Thornfield Hall.",
    genre: "Gothic romance",
    publishedYear: 1847,
    coverImageUrl: "https://picsum.photos/400/600?random=8",
  },
] as const;

async function seedDevUser() {
  await prisma.user.upsert({
    where: { clerkId: "user_dev_clerk_local" },
    create: {
      id: "dev_user_local",
      clerkId: "user_dev_clerk_local",
      email: "dev@novelviz.local",
      name: "Dev Reader",
      role: UserRole.admin,
    },
    update: {
      email: "dev@novelviz.local",
      name: "Dev Reader",
      role: UserRole.admin,
    },
  });
}

async function seedDevRoleUsers() {
  await prisma.user.upsert({
    where: { clerkId: "user_dev_clerk_reader" },
    create: {
      id: "dev_user_reader",
      clerkId: "user_dev_clerk_reader",
      email: "dev_reader@novelviz.local",
      name: "Dev Reader",
      role: UserRole.reader,
    },
    update: {
      email: "dev_reader@novelviz.local",
      name: "Dev Reader",
      role: UserRole.reader,
    },
  });

  await prisma.user.upsert({
    where: { clerkId: "user_dev_clerk_reader2" },
    create: {
      id: "dev_user_reader2",
      clerkId: "user_dev_clerk_reader2",
      email: "dev_reader2@novelviz.local",
      name: "Dev Reader 2",
      role: UserRole.reader,
    },
    update: {
      email: "dev_reader2@novelviz.local",
      name: "Dev Reader 2",
      role: UserRole.reader,
    },
  });

  await prisma.user.upsert({
    where: { clerkId: "user_dev_clerk_reader3" },
    create: {
      id: "dev_user_reader3",
      clerkId: "user_dev_clerk_reader3",
      email: "dev_reader3@novelviz.local",
      name: "Dev Reader 3",
      role: UserRole.reader,
    },
    update: {
      email: "dev_reader3@novelviz.local",
      name: "Dev Reader 3",
      role: UserRole.reader,
    },
  });

  await prisma.user.upsert({
    where: { clerkId: "user_dev_clerk_partner" },
    create: {
      id: "dev_user_partner",
      clerkId: "user_dev_clerk_partner",
      email: "dev_partner@novelviz.local",
      name: "Dev Partner",
      role: UserRole.partner,
    },
    update: {
      email: "dev_partner@novelviz.local",
      name: "Dev Partner",
      role: UserRole.partner,
    },
  });

  await prisma.user.upsert({
    where: { clerkId: "user_dev_clerk_partner2" },
    create: {
      id: "dev_user_partner2",
      clerkId: "user_dev_clerk_partner2",
      email: "dev_partner2@novelviz.local",
      name: "Dev Partner 2",
      role: UserRole.partner,
    },
    update: {
      email: "dev_partner2@novelviz.local",
      name: "Dev Partner 2",
      role: UserRole.partner,
    },
  });

  await prisma.user.upsert({
    where: { clerkId: "user_dev_clerk_admin" },
    create: {
      id: "dev_user_admin",
      clerkId: "user_dev_clerk_admin",
      email: "dev_admin@novelviz.local",
      name: "Dev Admin",
      role: UserRole.admin,
    },
    update: {
      email: "dev_admin@novelviz.local",
      name: "Dev Admin",
      role: UserRole.admin,
    },
  });
}

/** Dracula chapters + library + progress for spoiler testing (early vs late readers). */
async function seedDraculaChaptersAndReaderProgress() {
  const dracula = await prisma.book.findFirst({
    where: { title: "Dracula" },
    select: { id: true },
  });
  if (!dracula) return;

  for (let seq = 1; seq <= 15; seq++) {
    await prisma.chapter.upsert({
      where: {
        bookId_sequenceNumber: { bookId: dracula.id, sequenceNumber: seq },
      },
      create: {
        bookId: dracula.id,
        sequenceNumber: seq,
        title: `Chapter ${seq}`,
        rawText: `Seed placeholder for Dracula chapter ${seq}.`,
      },
      update: {},
    });
  }

  const ch2 = await prisma.chapter.findFirst({
    where: { bookId: dracula.id, sequenceNumber: 2 },
    select: { id: true },
  });
  const ch11 = await prisma.chapter.findFirst({
    where: { bookId: dracula.id, sequenceNumber: 11 },
    select: { id: true },
  });
  if (!ch2 || !ch11) return;

  for (const userId of ["dev_user_reader2", "dev_user_reader3"] as const) {
    await prisma.userBook.upsert({
      where: { userId_bookId: { userId, bookId: dracula.id } },
      create: { userId, bookId: dracula.id, isActive: true },
      update: { isActive: true },
    });
  }

  await prisma.readingProgress.upsert({
    where: {
      userId_bookId: { userId: "dev_user_reader2", bookId: dracula.id },
    },
    create: {
      userId: "dev_user_reader2",
      bookId: dracula.id,
      currentChapterId: ch2.id,
      currentChapterNumber: 2,
    },
    update: {
      currentChapterId: ch2.id,
      currentChapterNumber: 2,
    },
  });

  await prisma.readingProgress.upsert({
    where: {
      userId_bookId: { userId: "dev_user_reader3", bookId: dracula.id },
    },
    create: {
      userId: "dev_user_reader3",
      bookId: dracula.id,
      currentChapterId: ch11.id,
      currentChapterNumber: 11,
    },
    update: {
      currentChapterId: ch11.id,
      currentChapterNumber: 11,
    },
  });
}

async function seed() {
  await seedDevUser();
  await seedDevRoleUsers();

  for (const book of books) {
    const existing = await prisma.book.findFirst({
      where: { title: book.title },
    });
    const safeUpdateFields = {
      status: BookStatus.published,
      isPublicDomain: true,
      genre: book.genre,
      description: book.description,
      publishedYear: book.publishedYear,
    };
    if (existing) {
      await prisma.book.update({
        where: { id: existing.id },
        data: safeUpdateFields,
      });
    } else {
      await prisma.book.create({
        data: {
          title: book.title,
          author: book.author,
          coverImageUrl: book.coverImageUrl,
          ...safeUpdateFields,
        },
      });
    }
  }

  await seedDraculaChaptersAndReaderProgress();
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
