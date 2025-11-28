import { getDatabase } from "../lib/mongodb";

async function checkAgents() {
  try {
    console.log("🔍 Connecting to MongoDB...");
    const db = await getDatabase();
    
    console.log("📊 Database name:", db.databaseName);
    
    // Get all agents
    const agentsCollection = db.collection("agents");
    const allAgents = await agentsCollection.find({}).toArray();
    
    console.log("\n📋 Total agents in database:", allAgents.length);
    
    if (allAgents.length === 0) {
      console.log("⚠️ No agents found in database!");
    } else {
      console.log("\n👥 All agents:");
      allAgents.forEach((agent, index) => {
        console.log(`\n${index + 1}. ${agent.name}`);
        console.log(`   ID: ${agent._id}`);
        console.log(`   User: ${agent.userId}`);
        console.log(`   Description: ${agent.description}`);
        console.log(`   Expertise: ${agent.expertise?.join(", ") || "None"}`);
        console.log(`   Created: ${agent.createdAt}`);
      });
    }
    
    // Group by user
    const userGroups = allAgents.reduce((acc: any, agent) => {
      const userId = agent.userId || "unknown";
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(agent.name);
      return acc;
    }, {});
    
    console.log("\n👤 Agents by user:");
    Object.entries(userGroups).forEach(([userId, agents]) => {
      console.log(`\n${userId}:`);
      (agents as string[]).forEach(name => console.log(`  - ${name}`));
    });
    
    // Check for European Geography agent specifically
    const europeanAgent = allAgents.find(a => 
      a.name.toLowerCase().includes("european") && 
      a.name.toLowerCase().includes("geography")
    );
    
    if (europeanAgent) {
      console.log("\n✅ Found European Geography & Travel Expert:");
      console.log("   User:", europeanAgent.userId);
      console.log("   ID:", europeanAgent._id);
    } else {
      console.log("\n❌ European Geography & Travel Expert NOT FOUND");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkAgents();
