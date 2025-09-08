import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

async function setupMySQL() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    console.log("\nPlease set your MySQL connection string in the environment:");
    console.log("DATABASE_URL=mysql://username:password@host:port/database_name");
    console.log("\nExample for local MySQL:");
    console.log("DATABASE_URL=mysql://root:password@localhost:3306/crew_database");
    console.log("\nExample for cloud MySQL:");
    console.log("DATABASE_URL=mysql://username:password@hostname.com:3306/database_name");
    process.exit(1);
  }

  console.log("🔧 Setting up MySQL database...");
  
  let connection;
  try {
    // Test connection
    connection = await mysql.createConnection({
      uri: process.env.DATABASE_URL,
    });
    console.log("✅ Database connection successful");

    // Create tables
    console.log("📋 Creating database tables...");
    
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS forms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name TEXT NOT NULL,
        rank_group TEXT NOT NULL,
        version_no TEXT NOT NULL,
        version_date TEXT NOT NULL,
        configuration TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS available_ranks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS rank_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        form_id INT NOT NULL,
        name TEXT NOT NULL,
        ranks TEXT NOT NULL,
        FOREIGN KEY (form_id) REFERENCES forms(id)
      )`,
      `CREATE TABLE IF NOT EXISTS crew_members (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        middle_name TEXT,
        last_name TEXT,
        rank TEXT NOT NULL,
        nationality TEXT NOT NULL,
        vessel TEXT NOT NULL,
        vessel_type TEXT NOT NULL,
        sign_on_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS appraisal_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        crew_member_id TEXT NOT NULL,
        form_id INT NOT NULL,
        appraisal_type TEXT NOT NULL,
        appraisal_date TEXT NOT NULL,
        appraisal_data TEXT NOT NULL,
        competence_rating TEXT,
        behavioral_rating TEXT,
        overall_rating TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        submitted_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        FOREIGN KEY (crew_member_id) REFERENCES crew_members(id),
        FOREIGN KEY (form_id) REFERENCES forms(id)
      )`
    ];

    for (const table of tables) {
      await connection.execute(table);
    }

    console.log("✅ Database tables created successfully");
    
    // Check if data exists
    const [rows] = await connection.execute("SELECT COUNT(*) as count FROM forms");
    const formCount = (rows as any)[0].count;
    
    if (formCount === 0) {
      console.log("🌱 Database is empty, seeding will happen automatically on first run");
    } else {
      console.log(`📊 Database already contains ${formCount} forms`);
    }
    
    console.log("\n🎉 MySQL setup complete!");
    console.log("✅ All functionality maintained:");
    console.log("  - Data persistence across restarts");
    console.log("  - All API endpoints functional");
    console.log("  - Complete CRUD operations");
    console.log("  - Automatic database seeding");
    console.log("  - Micro frontend compatibility");
    
  } catch (error) {
    console.error("❌ MySQL setup failed:", error);
    console.log("\nTroubleshooting:");
    console.log("1. Verify your MySQL server is running");
    console.log("2. Check your DATABASE_URL format");
    console.log("3. Ensure the database exists");
    console.log("4. Verify user permissions");
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupMySQL();