import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import * as fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const prisma = new PrismaClient()

async function main() {
  const filePath = process.argv[2]
  const dishName = process.argv[3]
  const storageName = process.argv[4]

  if (!filePath || !dishName || !storageName) {
    console.log('Usage: npx tsx scripts/upload-dish.ts <file> <dishNameEn> <storage-name>')
    return
  }

  // Read and compress
  const input = fs.readFileSync(filePath)
  const compressed = await sharp(input)
    .resize(800, 600, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer()

  console.log(`Compressed: ${(input.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`)

  const fileName = `menu/${storageName}.webp`
  const { error } = await supabase.storage
    .from('menu-images')
    .upload(fileName, compressed, { contentType: 'image/webp', upsert: true })

  if (error) { console.error('Upload failed:', error); return }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-images/${fileName}`
  const result = await prisma.menuItem.updateMany({
    where: { nameEn: dishName },
    data: { imageUrl: publicUrl },
  })
  console.log(`✓ ${dishName} → ${(compressed.length / 1024).toFixed(0)}KB, updated ${result.count} item`)
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect() })
