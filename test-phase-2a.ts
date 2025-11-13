import { DatabaseStorage } from "./server/database";

async function testPhase2A() {
  console.log("🧪 PHASE 2A: Testing Core Configuration Methods (30 methods)\n");
  
  const db = new DatabaseStorage();
  let testsPass = 0;
  let testsFailed = 0;

  try {
    // GROUP 1: User Methods (3 methods)
    console.log("📋 GROUP 1: User Methods (3 methods)");
    
    // Test createUser
    const testUser = await db.createUser({
      username: "test_user_phase2a",
      password: "hashed_password_123"
    });
    console.log(`  ✅ createUser: Created user #${testUser.id} - ${testUser.username}`);
    testsPass++;

    // Test getUserByUsername
    const foundUser = await db.getUserByUsername("test_user_phase2a");
    if (foundUser && foundUser.id === testUser.id) {
      console.log(`  ✅ getUserByUsername: Found user ${foundUser.username}`);
      testsPass++;
    } else {
      console.log(`  ❌ getUserByUsername: Failed to find user`);
      testsFailed++;
    }

    // Test getUser
    const foundById = await db.getUser(testUser.id);
    if (foundById && foundById.id === testUser.id) {
      console.log(`  ✅ getUser: Found user by ID ${foundById.id}`);
      testsPass++;
    } else {
      console.log(`  ❌ getUser: Failed to find user by ID`);
      testsFailed++;
    }

    // GROUP 2: Forms Management (9 methods)
    console.log("\n📋 GROUP 2: Forms Management (9 methods)");
    
    // Test createForm
    const testForm = await db.createForm({
      name: "Test Form Phase 2A",
      rankGroup: ["Captain", "Chief Officer"],
      versionNo: "1.0",
      versionDate: new Date().toISOString(),
      category: "appraisal"
    });
    console.log(`  ✅ createForm: Created form #${testForm.id} - ${testForm.name}`);
    testsPass++;

    // Test getForms
    const allForms = await db.getForms();
    if (allForms.length > 0) {
      console.log(`  ✅ getForms: Retrieved ${allForms.length} forms`);
      testsPass++;
    } else {
      console.log(`  ❌ getForms: No forms found`);
      testsFailed++;
    }

    // Test getForm
    const foundForm = await db.getForm(testForm.id);
    if (foundForm && foundForm.id === testForm.id) {
      console.log(`  ✅ getForm: Found form ${foundForm.name}`);
      testsPass++;
    } else {
      console.log(`  ❌ getForm: Failed to find form`);
      testsFailed++;
    }

    // Test updateForm
    const updatedForm = await db.updateForm(testForm.id, {
      name: "Updated Test Form Phase 2A"
    });
    if (updatedForm && updatedForm.name === "Updated Test Form Phase 2A") {
      console.log(`  ✅ updateForm: Updated form name`);
      testsPass++;
    } else {
      console.log(`  ❌ updateForm: Failed to update form`);
      testsFailed++;
    }

    // Test createRankGroup
    const testRankGroup = await db.createRankGroup({
      formId: testForm.id,
      name: "Officers",
      ranks: ["Captain", "Chief Officer", "Second Officer"]
    });
    console.log(`  ✅ createRankGroup: Created rank group #${testRankGroup.id}`);
    testsPass++;

    // Test getRankGroups
    const allRankGroups = await db.getRankGroups();
    if (allRankGroups.length > 0) {
      console.log(`  ✅ getRankGroups: Retrieved ${allRankGroups.length} rank groups`);
      testsPass++;
    } else {
      console.log(`  ❌ getRankGroups: No rank groups found`);
      testsFailed++;
    }

    // Test updateRankGroup
    const updatedRankGroup = await db.updateRankGroup(testRankGroup.id, {
      name: "Senior Officers"
    });
    if (updatedRankGroup && updatedRankGroup.name === "Senior Officers") {
      console.log(`  ✅ updateRankGroup: Updated rank group name`);
      testsPass++;
    } else {
      console.log(`  ❌ updateRankGroup: Failed to update rank group`);
      testsFailed++;
    }

    // Test deleteRankGroup
    const deletedRankGroup = await db.deleteRankGroup(testRankGroup.id);
    if (deletedRankGroup) {
      console.log(`  ✅ deleteRankGroup: Deleted rank group #${testRankGroup.id}`);
      testsPass++;
    } else {
      console.log(`  ❌ deleteRankGroup: Failed to delete rank group`);
      testsFailed++;
    }

    // Test deleteForm
    const deletedForm = await db.deleteForm(testForm.id);
    if (deletedForm) {
      console.log(`  ✅ deleteForm: Deleted form #${testForm.id}`);
      testsPass++;
    } else {
      console.log(`  ❌ deleteForm: Failed to delete form`);
      testsFailed++;
    }

    // GROUP 3: Available Ranks (6 methods)
    console.log("\n📋 GROUP 3: Available Ranks (6 methods)");
    
    // Test createAvailableRank
    const testRank1 = await db.createAvailableRank({
      name: "Test Captain",
      category: "Deck Officers",
      sortOrder: 1
    });
    console.log(`  ✅ createAvailableRank: Created rank #${testRank1.id} - ${testRank1.name}`);
    testsPass++;

    const testRank2 = await db.createAvailableRank({
      name: "Test Chief Officer",
      category: "Deck Officers",
      sortOrder: 2
    });
    console.log(`  ✅ createAvailableRank: Created rank #${testRank2.id} - ${testRank2.name}`);
    testsPass++;

    // Test getAvailableRanks
    const allRanks = await db.getAvailableRanks();
    if (allRanks.length >= 2) {
      console.log(`  ✅ getAvailableRanks: Retrieved ${allRanks.length} ranks`);
      testsPass++;
    } else {
      console.log(`  ❌ getAvailableRanks: Expected at least 2 ranks`);
      testsFailed++;
    }

    // Test updateAvailableRank
    const updatedRank = await db.updateAvailableRank(testRank1.id, {
      name: "Test Master"
    });
    if (updatedRank && updatedRank.name === "Test Master") {
      console.log(`  ✅ updateAvailableRank: Updated rank to ${updatedRank.name}`);
      testsPass++;
    } else {
      console.log(`  ❌ updateAvailableRank: Failed to update rank`);
      testsFailed++;
    }

    // Test updateRankOrders
    const orderUpdated = await db.updateRankOrders([
      { id: testRank1.id, sortOrder: 10 },
      { id: testRank2.id, sortOrder: 20 }
    ]);
    if (orderUpdated) {
      console.log(`  ✅ updateRankOrders: Updated sort orders for 2 ranks`);
      testsPass++;
    } else {
      console.log(`  ❌ updateRankOrders: Failed to update rank orders`);
      testsFailed++;
    }

    // Test deleteAvailableRank
    const deletedRank1 = await db.deleteAvailableRank(testRank1.id);
    const deletedRank2 = await db.deleteAvailableRank(testRank2.id);
    if (deletedRank1 && deletedRank2) {
      console.log(`  ✅ deleteAvailableRank: Deleted 2 test ranks`);
      testsPass++;
    } else {
      console.log(`  ❌ deleteAvailableRank: Failed to delete ranks`);
      testsFailed++;
    }

    // GROUP 4: Company Ranks (7 methods)
    console.log("\n📋 GROUP 4: Company Ranks (7 methods)");
    
    // Test createCompanyRank
    const companyRank1 = await db.createCompanyRank({
      id: "TEST_CAPTAIN",
      rank: "Test Captain",
      rankId: "CAPT"
    });
    console.log(`  ✅ createCompanyRank: Created company rank ${companyRank1.id}`);
    testsPass++;

    const companyRank2 = await db.createCompanyRank({
      id: "TEST_CHIEF_ENG",
      rank: "Test Chief Engineer",
      rankId: "C/E"
    });
    console.log(`  ✅ createCompanyRank: Created company rank ${companyRank2.id}`);
    testsPass++;

    // Test getCompanyRanks
    const allCompanyRanks = await db.getCompanyRanks();
    if (allCompanyRanks.length >= 2) {
      console.log(`  ✅ getCompanyRanks: Retrieved ${allCompanyRanks.length} company ranks`);
      testsPass++;
    } else {
      console.log(`  ❌ getCompanyRanks: Expected at least 2 company ranks`);
      testsFailed++;
    }

    // Test getCompanyRank
    const foundCompanyRank = await db.getCompanyRank("TEST_CAPTAIN");
    if (foundCompanyRank && foundCompanyRank.id === "TEST_CAPTAIN") {
      console.log(`  ✅ getCompanyRank: Found company rank ${foundCompanyRank.rank}`);
      testsPass++;
    } else {
      console.log(`  ❌ getCompanyRank: Failed to find company rank`);
      testsFailed++;
    }

    // Test updateCompanyRank
    const updatedCompanyRank = await db.updateCompanyRank("TEST_CAPTAIN", {
      rank: "Test Master"
    });
    if (updatedCompanyRank && updatedCompanyRank.rank === "Test Master") {
      console.log(`  ✅ updateCompanyRank: Updated rank to ${updatedCompanyRank.rank}`);
      testsPass++;
    } else {
      console.log(`  ❌ updateCompanyRank: Failed to update company rank`);
      testsFailed++;
    }

    // Test saveAllCompanyRanks
    const savedRanks = await db.saveAllCompanyRanks([
      { id: "SAVE_TEST_1", rank: "Saved Rank 1", rankId: "SR1" },
      { id: "SAVE_TEST_2", rank: "Saved Rank 2", rankId: "SR2" }
    ]);
    if (savedRanks.length === 2) {
      console.log(`  ✅ saveAllCompanyRanks: Saved ${savedRanks.length} company ranks (cleared old ones)`);
      testsPass++;
    } else {
      console.log(`  ❌ saveAllCompanyRanks: Failed to save all ranks`);
      testsFailed++;
    }

    // Test deleteCompanyRank
    const deletedCompanyRank = await db.deleteCompanyRank("SAVE_TEST_1");
    if (deletedCompanyRank) {
      console.log(`  ✅ deleteCompanyRank: Deleted company rank SAVE_TEST_1`);
      testsPass++;
    } else {
      console.log(`  ❌ deleteCompanyRank: Failed to delete company rank`);
      testsFailed++;
    }

    // Test clearAllCompanyRanks
    const clearedCompanyRanks = await db.clearAllCompanyRanks();
    if (clearedCompanyRanks) {
      console.log(`  ✅ clearAllCompanyRanks: Cleared all company ranks`);
      testsPass++;
    } else {
      console.log(`  ❌ clearAllCompanyRanks: Failed to clear company ranks`);
      testsFailed++;
    }

    // GROUP 5: Promotion Hierarchies (5 methods)
    console.log("\n📋 GROUP 5: Promotion Hierarchies (5 methods)");
    
    // Test createPromotionHierarchy
    const hierarchy1 = await db.createPromotionHierarchy({
      groupName: "Deck Officers Progression",
      rankPath: ["Third Officer", "Second Officer", "Chief Officer", "Captain"]
    });
    console.log(`  ✅ createPromotionHierarchy: Created hierarchy #${hierarchy1.id}`);
    testsPass++;

    const hierarchy2 = await db.createPromotionHierarchy({
      groupName: "Engine Officers Progression",
      rankPath: ["Third Engineer", "Second Engineer", "Chief Engineer"]
    });
    console.log(`  ✅ createPromotionHierarchy: Created hierarchy #${hierarchy2.id}`);
    testsPass++;

    // Test getPromotionHierarchies
    const allHierarchies = await db.getPromotionHierarchies();
    if (allHierarchies.length >= 2) {
      console.log(`  ✅ getPromotionHierarchies: Retrieved ${allHierarchies.length} hierarchies`);
      testsPass++;
    } else {
      console.log(`  ❌ getPromotionHierarchies: Expected at least 2 hierarchies`);
      testsFailed++;
    }

    // Test getPromotionHierarchy
    const foundHierarchy = await db.getPromotionHierarchy(hierarchy1.id);
    if (foundHierarchy && foundHierarchy.id === hierarchy1.id) {
      console.log(`  ✅ getPromotionHierarchy: Found hierarchy ${foundHierarchy.groupName}`);
      testsPass++;
    } else {
      console.log(`  ❌ getPromotionHierarchy: Failed to find hierarchy`);
      testsFailed++;
    }

    // Test updatePromotionHierarchy
    const updatedHierarchy = await db.updatePromotionHierarchy(hierarchy1.id, {
      groupName: "Updated Deck Officers"
    });
    if (updatedHierarchy && updatedHierarchy.groupName === "Updated Deck Officers") {
      console.log(`  ✅ updatePromotionHierarchy: Updated groupName to ${updatedHierarchy.groupName}`);
      testsPass++;
    } else {
      console.log(`  ❌ updatePromotionHierarchy: Failed to update hierarchy`);
      testsFailed++;
    }

    // Test deletePromotionHierarchy
    const deletedHierarchy1 = await db.deletePromotionHierarchy(hierarchy1.id);
    const deletedHierarchy2 = await db.deletePromotionHierarchy(hierarchy2.id);
    if (deletedHierarchy1 && deletedHierarchy2) {
      console.log(`  ✅ deletePromotionHierarchy: Deleted 2 test hierarchies`);
      testsPass++;
    } else {
      console.log(`  ❌ deletePromotionHierarchy: Failed to delete hierarchies`);
      testsFailed++;
    }

    // Final Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 PHASE 2A TEST RESULTS");
    console.log("=".repeat(60));
    console.log(`✅ Tests Passed: ${testsPass}/30`);
    console.log(`❌ Tests Failed: ${testsFailed}/30`);
    console.log(`📈 Success Rate: ${((testsPass / 30) * 100).toFixed(1)}%`);
    console.log("=".repeat(60));

    if (testsPass === 30) {
      console.log("\n🎉 ALL 30 METHODS WORKING CORRECTLY!");
      console.log("✅ Phase 2A: Core Configuration Methods - COMPLETE");
    } else {
      console.log("\n⚠️ Some tests failed. Please review the errors above.");
    }

  } catch (error) {
    console.error("\n❌ Test execution failed:", error);
  } finally {
    await db.close();
  }
}

testPhase2A().catch(console.error);
