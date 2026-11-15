/**
 * Script to delete the invalid Gemini credential
 * Run with: npx tsx scripts/delete-invalid-credential.ts
 */

import prisma from "../src/lib/db";

const INVALID_CREDENTIAL_ID = "cmwhrb4o20003jq08970w2ncf";

async function deleteInvalidCredential() {
  console.log("🗑️  Deleting invalid Gemini credential...\n");

  const credential = await prisma.credential.findUnique({
    where: { id: INVALID_CREDENTIAL_ID },
  });

  if (!credential) {
    console.log("❌ Credential not found");
    return;
  }

  console.log(`Found credential: ${credential.name}`);
  console.log(`User ID: ${credential.userId}`);
  console.log(`Type: ${credential.type}`);

  await prisma.credential.delete({
    where: { id: INVALID_CREDENTIAL_ID },
  });

  console.log("\n✅ Invalid credential deleted");
  console.log("\n📝 Next steps:");
  console.log("1. User should log in to: https://auto-nate.vercel.app");
  console.log("2. Go to Credentials page");
  console.log("3. Create a new Gemini credential");
  console.log("4. Get a valid API key from: https://aistudio.google.com/app/apikey");
}

deleteInvalidCredential()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
