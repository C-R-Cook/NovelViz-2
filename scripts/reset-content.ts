import { PrismaClient } from '../app/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('Deleting content...')

  await prisma.notification.deleteMany({})
  await prisma.comment.deleteMany({})
  await prisma.like.deleteMany({})
  await prisma.featureRequest.deleteMany({})
  await prisma.generatedImage.deleteMany({})
  await prisma.query.deleteMany({})
  await prisma.chunk.deleteMany({})
  await prisma.chapter.deleteMany({})
  await prisma.userBook.deleteMany({})
  await prisma.readingProgress.deleteMany({})
  await prisma.bookRequest.deleteMany({})
  await prisma.book.deleteMany({})

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())