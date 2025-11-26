/**
 * Database Statistics Script
 * 
 * Run this script to view database statistics:
 * 
 * npm run db:stats
 */

import { getDatabaseStats, verifyConnection } from "../lib/db/initDb";

async function main() {
  console.log("📊 Fetching database statistics...\n");

  // Verify connection
  const isConnected = await verifyConnection();
  if (!isConnected) {
    console.error("Failed to connect to database. Check your MONGODB_URI.");
    process.exit(1);
  }

  console.log("");

  // Get and display stats
  const stats = await getDatabaseStats();
  console.log("Database Statistics:");
  console.table(stats.collections);

  // Calculate totals
  const totals = stats.collections.reduce(
    (acc, col) => ({
      documents: acc.documents + col.count,
      size: acc.size + col.size,
      indexes: acc.indexes + col.indexes,
    }),
    { documents: 0, size: 0, indexes: 0 }
  );

  console.log("\nTotals:");
  console.log(`  Documents: ${totals.documents}`);
  console.log(`  Size: ${(totals.size / 1024).toFixed(2)} KB`);
  console.log(`  Indexes: ${totals.indexes}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
