import { DatabaseStorage } from "./server/database";

async function testUser() {
  const db = new DatabaseStorage();
  
  try {
    console.log("Testing User CRUD operations...\n");
    
    // Test 1: Create user
    const created = await db.createUser({
      username: `test_${Date.now()}`,
      password: "hashed_123"
    });
    console.log(`✅ Created user: ID=${created.id}, username=${created.username}`);
    
    // Test 2: Get by ID
    const foundById = await db.getUser(created.id);
    console.log(`✅ Found by ID: ${foundById?.username || 'NOT FOUND'}`);
    
    // Test 3: Get by username
    const foundByUsername = await db.getUserByUsername(created.username);
    console.log(`✅ Found by username: ${foundByUsername?.username || 'NOT FOUND'}`);
    
    if (foundByUsername && foundByUsername.id === created.id) {
      console.log("\n🎉 ALL USER METHODS WORKING!");
    } else {
      console.log(`\n❌ ISSUE: Created ID=${created.id}, found ID=${foundByUsername?.id || 'NULL'}`);
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await db.close();
  }
}

testUser().catch(console.error);
