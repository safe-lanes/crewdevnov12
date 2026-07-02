import pg from "pg";
import { fileStorageService } from "../v2/shared/fileStorageService.js";
import { decodeStoredFile } from "../v2/shared/serveAttachmentHelper.js";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;

interface ChecklistAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // Base64 data URL
  uploadedAt?: string;
  uploadDate?: string;
}

/**
 * Runs backfill migration on a single tenant database pool.
 */
async function backfillTenant(connectionString: string, domainName: string, label: string): Promise<void> {
  const requiresSsl =
    connectionString.includes("sslmode=require") || connectionString.includes("ssl=true");

  const pool = new Pool({
    connectionString,
    ssl: requiresSsl
      ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
      : false,
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    console.log(`\n🔍 [${label}] Scanning promotions checklist progress for legacy base64 attachments...`);

    // 1. Fetch rows that contain legacy attachments
    const query = `
      SELECT cp_uuid, review_uuid, section_id, assessment_point_id, deprecated_attachments_data 
      FROM public.promo_checklist_progress_v2
      WHERE deprecated_attachments_data IS NOT NULL 
        AND deprecated_attachments_data <> '[]'
        AND deprecated_attachments_data <> '';
    `;

    const res = await client.query(query);
    const rows = res.rows;
    console.log(`📊 [${label}] Found ${rows.length} rows to backfill.`);

    let totalMigratedFiles = 0;

    for (const row of rows) {
      const { cp_uuid, deprecated_attachments_data } = row;
      let attachments: ChecklistAttachment[] = [];

      try {
        attachments = JSON.parse(deprecated_attachments_data);
      } catch (err) {
        console.error(`❌ [${label}] Failed to parse JSON for progress UUID ${cp_uuid}:`, err);
        continue;
      }

      if (!Array.isArray(attachments) || attachments.length === 0) {
        // Set to empty to mark as migrated
        await client.query(
          "UPDATE public.promo_checklist_progress_v2 SET deprecated_attachments_data = '[]' WHERE cp_uuid = $1",
          [cp_uuid]
        );
        continue;
      }

      console.log(`   └─ Progress [${cp_uuid}]: Migrating ${attachments.length} attachments...`);
      let successCount = 0;

      for (const att of attachments) {
        if (!att.data) {
          console.warn(`      ⚠️ Attachment ID ${att.id} has no file data, skipping.`);
          continue;
        }

        const decoded = decodeStoredFile(att.data, att.type, true);
        if (!decoded) {
          console.error(`      ❌ Failed to decode base64 for file '${att.name}', skipping.`);
          continue;
        }

        const { buffer, mime } = decoded;
        const finalName = att.name || "attachment";
        const attUuid = att.id || uuidv4();

        // Save file to disk
        try {
          const filePath = await fileStorageService.writeAttachment(
            "promotions/briefing",
            finalName,
            buffer,
            domainName
          );

          // Write record to the new attachments table
          const insertQuery = `
            INSERT INTO public.promo_checklist_attachments_v2 (
              att_uuid, checklist_progress_uuid, file_name, file_path, file_size, file_type, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (att_uuid) DO NOTHING;
          `;
          
          const uploadDateStr = att.uploadedAt || att.uploadDate || new Date().toISOString();
          const uploadDate = new Date(uploadDateStr);

          await client.query(insertQuery, [
            attUuid,
            cp_uuid,
            finalName,
            filePath,
            att.size?.toString() || buffer.length.toString(),
            att.type || mime,
            uploadDate,
            uploadDate,
          ]);

          successCount++;
          totalMigratedFiles++;
        } catch (err: any) {
          console.error(`      ❌ Error saving file '${finalName}':`, err.message);
        }
      }

      // If we successfully processed all attachments, clear the deprecated column
      if (successCount === attachments.length) {
        await client.query(
          "UPDATE public.promo_checklist_progress_v2 SET deprecated_attachments_data = '[]' WHERE cp_uuid = $1",
          [cp_uuid]
        );
      } else {
        console.warn(`      ⚠️ Only ${successCount}/${attachments.length} files migrated. Leaving column data intact.`);
      }
    }

    console.log(`✅ [${label}] Backfill complete. Migrated ${totalMigratedFiles} files successfully.`);
  } catch (err: any) {
    console.error(`❌ [${label}] Migration failed:`, err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Main Runner
 */
async function main() {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  const singleUrl = process.env.DATABASE_URL;

  if (masterUrl) {
    console.log("🏢 Multi-tenant mode: resolving all active tenant databases...");
    const masterPool = new Pool({
      connectionString: masterUrl,
      ssl: masterUrl.includes("sslmode=require") || masterUrl.includes("ssl=true")
        ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
        : false,
      max: 2,
    });

    const client = await masterPool.connect();
    try {
      const res = await client.query(
        "SELECT tuid, domain FROM public.tenants WHERE is_active = true AND is_deleted = false"
      );
      
      const tenantsList = res.rows;
      console.log(`👥 Found ${tenantsList.length} active tenants.`);

      for (const tenant of tenantsList) {
        const { tuid, domain } = tenant;
        const tenantUrl = new URL(masterUrl);
        tenantUrl.pathname = `/${tuid}`;

        await backfillTenant(tenantUrl.toString(), domain, `Tenant: ${tuid}`);
      }
    } catch (err: any) {
      console.error("❌ Failed to query tenants table:", err.message);
    } finally {
      client.release();
      await masterPool.end();
    }
  } else if (singleUrl) {
    console.log("🏠 Single-tenant mode: migrating main database...");
    await backfillTenant(singleUrl, "main", "Single Tenant");
  } else {
    console.error("❌ Error: Neither MASTER_DATABASE_URL nor DATABASE_URL environment variables are configured.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ Backfill execution failed:", err);
  process.exit(1);
});
