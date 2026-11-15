/**
 * Check a specific credential by ID
 * Run with: npx tsx scripts/check-specific-credential.ts
 */

import { config } from "dotenv";
config(); // Load .env file

import { decrypt } from "../src/lib/encryption";

const encryptedValue = "e070bd32e56fb9a9cdd03ce1fda8476f9541ed8b1b9341780fe7a45d120b1ba6b847762ce4196bb74926e4e6bcd14493e133aad4bce0944e4784435f9006b8fc09ade1305167491e07b1f04dfae00962d0b2285dd99d7d607f372f3fd081e2b6e47062b3b39d85e8bd5ff4edb57b5d6c8ddede666e0286b30b0dbc63519f3cfa1311503bc71e037bc4373ad95d03f892c6e5b9e8ff";

try {
  const decrypted = decrypt(encryptedValue);
  console.log("✅ Decryption: SUCCESS");
  console.log(`📏 Length: ${decrypted.length}`);
  console.log(`🔑 Starts with: ${decrypted.substring(0, 10)}...`);
  console.log(`🔑 Ends with: ...${decrypted.substring(decrypted.length - 10)}`);
  
  // Check format
  if (decrypted.startsWith("AIza") || decrypted.startsWith("AQ")) {
    console.log("✅ Valid Gemini API key format");
  } else {
    console.log("⚠️  WARNING: Does not match expected Gemini API key format");
    console.log(`   Expected to start with 'AIza' or 'AQ', but starts with: ${decrypted.substring(0, 5)}`);
  }
  
  if (decrypted.length >= 30 && decrypted.length <= 50) {
    console.log("✅ Length is within expected range (30-50 chars)");
  } else {
    console.log(`⚠️  WARNING: Length ${decrypted.length} is outside typical range (30-50)`);
  }
  
} catch (error) {
  console.error("❌ Decryption FAILED");
  console.error(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
}
