/**
 * Database Initialization Script
 * 
 * Run this script to set up MongoDB indexes and verify the connection:
 * 
 * npx tsx scripts/init-db.ts
 */

import { initializeDatabase, verifyConnection, getDatabaseStats } from "../lib/db/initDb";

async function main() {
  console.log("🚀 Starting database initialization...\n");

  // Verify connection first
  const isConnected = await verifyConnection();
  if (!isConnected) {
    console.error("Failed to connect to database. Check your MONGODB_URI.");
    process.exit(1);
  }

  console.log("");

  // Initialize database with indexes
  await initializeDatabase();

  console.log("");

  // Show database statistics
  console.log("📊 Database Statistics:");
  const stats = await getDatabaseStats();
  console.table(stats.collections);

  console.log("\n✨ Database is ready to use!");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
