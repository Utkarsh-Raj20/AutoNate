/**
 * Script to verify and re-encrypt credentials
 * Run with: npx tsx scripts/verify-credentials.ts
 */

import prisma from "../src/lib/db";
import { decrypt, encrypt } from "../src/lib/encryption";

async function verifyCredentials() {
  console.log("🔍 Checking all credentials...\n");

  const credentials = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    type: string;
    value: string;
    userId: string;
  }>>`
    SELECT c.id, c.name, c.type, c.value, c."userId"
    FROM "Credential" c
  `;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
    },
  });

  const userMap = new Map(users.map(u => [u.id, u.email]));

  console.log(`Found ${credentials.length} credentials\n`);

  for (const cred of credentials) {
    console.log(`📋 Credential: ${cred.name} (${cred.type})`);
    console.log(`   User: ${userMap.get(cred.userId) || 'Unknown'}`);
    console.log(`   ID: ${cred.id}`);

    try {
      const decrypted = decrypt(cred.value);
      console.log(`   ✅ Decryption: SUCCESS`);
      console.log(`   📏 Length: ${decrypted.length}`);
      console.log(`   🔑 Starts with: ${decrypted.substring(0, 10)}...`);
      
      if (cred.type === "GEMINI" && !decrypted.startsWith("AI")) {
        console.log(`   ⚠️  WARNING: Gemini API key should start with "AI"`);
      }
      
      if (decrypted.trim() !== decrypted) {
        console.log(`   ⚠️  WARNING: API key has leading/trailing whitespace`);
      }
      
    } catch (error) {
      console.log(`   ❌ Decryption: FAILED`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    
    console.log("");
  }
}

verifyCredentials()
  .then(() => {
    console.log("✅ Verification complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
