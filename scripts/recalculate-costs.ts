/**
 * Script to recalculate usage costs with updated pricing
 * Run with: npx tsx scripts/recalculate-costs.ts
 */

import { getDatabase } from "../lib/mongodb";

async function recalculateCosts() {
  console.log("🔄 Starting cost recalculation...");
  
  const db = await getDatabase();
  const collection = db.collection("usage_logs");
  
  // Get all usage logs
  const logs = await collection.find({}).toArray();
  console.log(`📊 Found ${logs.length} usage logs to recalculate`);
  
  let updated = 0;
  
  for (const log of logs) {
    let newCost = 0;
    
    if (log.service === "claude-haiku") {
      // New pricing: $1.00/M input, $5.00/M output, 0.1x for cached
      newCost = (
        log.tokens.input * 1.00 +
        log.tokens.output * 5.00 +
        log.tokens.cached * 0.10
      ) / 1_000_000;
    } else if (log.service === "claude-sonnet") {
      // Sonnet pricing: $3.00/M input, $15.00/M output
      newCost = (
        log.tokens.input * 3.00 +
        log.tokens.output * 15.00 +
        log.tokens.cached * 0.30
      ) / 1_000_000;
    } else {
      // Keep other services as-is (elevenlabs, web-speech)
      continue;
    }
    
    // Update the log with new cost
    await collection.updateOne(
      { _id: log._id },
      { $set: { cost: newCost } }
    );
    
    updated++;
    
    if (updated % 10 === 0) {
      console.log(`✅ Updated ${updated}/${logs.length} logs...`);
    }
  }
  
  console.log(`\n✅ Recalculation complete!`);
  console.log(`📝 Updated ${updated} usage logs with new pricing`);
  
  // Show before/after totals
  const oldTotal = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const newLogs = await collection.find({}).toArray();
  const newTotal = newLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
  
  console.log(`\n💰 Cost Summary:`);
  console.log(`   Old total: $${oldTotal.toFixed(4)}`);
  console.log(`   New total: $${newTotal.toFixed(4)}`);
  console.log(`   Difference: $${(newTotal - oldTotal).toFixed(4)} (${((newTotal / oldTotal - 1) * 100).toFixed(1)}%)`);
  
  process.exit(0);
}

recalculateCosts().catch((error) => {
  console.error("❌ Error recalculating costs:", error);
  process.exit(1);
});
