import { storage } from "./storage";
import { dataMasters, masterDataEntries } from "@shared/schema";
import { sql } from "drizzle-orm";

async function setupTables() {
  try {
    console.log("🔨 Setting up database tables...");
    
    // Create data_masters table
    await (storage as any).db.execute(sql`
      CREATE TABLE IF NOT EXISTS data_masters (
        id VARCHAR(10) PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create master_data_entries table
    await (storage as any).db.execute(sql`
      CREATE TABLE IF NOT EXISTS master_data_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        master_id VARCHAR(10) NOT NULL,
        entry_id VARCHAR(10) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX master_id_idx (master_id),
        FOREIGN KEY (master_id) REFERENCES data_masters(id) ON DELETE CASCADE
      )
    `);
    
    console.log("✅ Database tables created successfully!");
    
    // Seed master categories
    const masterCategories = [
      { id: '001', name: 'Nationality', description: 'Crew member nationalities' },
      { id: '002', name: 'Country', description: 'Countries and regions' },
      { id: '003', name: 'Language', description: 'Languages spoken' },
      { id: '004', name: 'Vessel Type', description: 'Types of vessels' },
      { id: '005', name: 'Port', description: 'Ports and terminals' },
      { id: '006', name: 'Qualification', description: 'Qualifications and certifications' },
      { id: '007', name: 'Course', description: 'Training courses' },
      { id: '008', name: 'Contract Type', description: 'Types of contracts' },
      { id: '009', name: 'Medical Status', description: 'Medical examination status' },
      { id: '010', name: 'Document Type', description: 'Document types' },
      { id: '011', name: 'Equipment', description: 'Ship equipment and machinery' },
      { id: '012', name: 'Designation', description: 'Job designations and positions' },
      { id: '013', name: 'Users', description: 'System users and roles' },
      { id: '014', name: 'Vessels', description: 'Vessel names and registrations' },
      { id: '015', name: 'Fleet Groups', description: 'Fleet groupings and categories' },
      { id: '016', name: 'Additional Groups', description: 'Additional grouping categories' },
      { id: '017', name: 'Vessel Owners', description: 'Vessel ownership information' }
    ];

    for (const master of masterCategories) {
      try {
        await storage.createDataMaster(master);
      } catch (error) {
        // Ignore duplicate key errors - master might already exist
        if (!(error as any).message.includes('Duplicate entry')) {
          console.warn(`Warning creating master ${master.id}:`, error);
        }
      }
    }
    
    // Seed sample data for some categories
    const sampleData = [
      // Nationality (001)
      { masterId: '001', entryId: '001', name: 'Filipino', description: 'Philippines' },
      { masterId: '001', entryId: '002', name: 'Indian', description: 'India' },
      { masterId: '001', entryId: '003', name: 'Ukrainian', description: 'Ukraine' },
      
      // Vessel Type (004)
      { masterId: '004', entryId: '001', name: 'Container Ship', description: 'Cargo container vessel' },
      { masterId: '004', entryId: '002', name: 'Bulk Carrier', description: 'Dry bulk cargo vessel' },
      { masterId: '004', entryId: '003', name: 'Tanker', description: 'Oil/chemical tanker' },
      
      // Contract Type (008)
      { masterId: '008', entryId: '001', name: 'Permanent', description: 'Full-time permanent contract' },
      { masterId: '008', entryId: '002', name: 'Fixed Term', description: 'Fixed-term contract' },
      { masterId: '008', entryId: '003', name: 'Casual', description: 'Casual/temporary contract' },
    ];

    for (const entry of sampleData) {
      try {
        await storage.createMasterDataEntry(entry);
      } catch (error) {
        // Ignore duplicate key errors
        if (!(error as any).message.includes('Duplicate entry')) {
          console.warn(`Warning creating entry ${entry.masterId}-${entry.entryId}:`, error);
        }
      }
    }
    
    console.log("✅ Database seeded successfully!");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    process.exit(1);
  }
}

setupTables();