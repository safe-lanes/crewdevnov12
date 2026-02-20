import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Seafarer Performance Management System API",
      version: "2.0.0",
      description:
        "Maritime operations platform API for crew management, vessel operations, and regulatory compliance.",
    },
    servers: [
      {
        url: "/",
        description: "Current server",
      },
    ],
    tags: [
      { name: "Health", description: "System health checks" },
      { name: "Crew Pool", description: "Crew member management, assignments, personal details, documents, training, sea service, medicals" },
      { name: "Rest Hours", description: "Work/rest hour compliance tracking — vessel records, crew records, daily records, comments, NC reports, tasks" },
      { name: "Vessel", description: "Vessel management — planning, compliance matrix, training matrix, officer matrix" },
      { name: "Rotation", description: "Crew rotation planning — drafts, proposals, entries, deployments" },
      { name: "Admin", description: "Company administration — forms, rank groups, available ranks, promotion hierarchies, training config, vessel revisions" },
      { name: "Masters", description: "Reference data — nationalities, vessels, vessel types, ports, countries, languages, users, licenses, manning agents" },
      { name: "Masters - Data", description: "Configurable master data tables — CRUD for masters and their entries (visa types, travel documents, licenses, etc.)" },
      { name: "Masters - External Sync", description: "External master data sync — cached data from SAIL ERP and bulk sync operations" },
      { name: "Recruitment", description: "Candidate recruitment — applications, screening, approvals, suitability, decisions" },
      { name: "Promotions", description: "Promotion reviews and criteria management" },
      { name: "Appraisals", description: "Crew appraisals — 3-stage workflow for performance evaluation" },
      { name: "Drugs & Alcohol", description: "Drug & alcohol test records and attachments" },
      { name: "Ports", description: "Port search and lookup" },
      { name: "[LEGACY] Crew Members", description: "Legacy crew member list — scheduled for migration to v2" },
      { name: "[LEGACY] Pay Elements", description: "Legacy payroll element endpoints — scheduled for migration to v2" },
    ],
  },
  apis: [
    "./server/swagger-docs/*.ts",
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: `
        .swagger-ui .opblock.opblock-deprecated .opblock-summary {
          border-color: #ebebeb;
          background: hsla(0,0%,92%,.1);
        }
        .swagger-ui .opblock.opblock-deprecated .opblock-summary-description {
          color: #999;
        }
        .swagger-ui .opblock.opblock-deprecated .tab-header .tab-item.active h4 span::after {
          content: " [LEGACY]";
          color: #e67e22;
          font-size: 11px;
          font-weight: bold;
        }
        .swagger-ui .info .title { font-size: 28px; }
      `,
      customSiteTitle: "SPMS API Documentation",
      swaggerOptions: {
        docExpansion: "none",
        filter: true,
        tagsSorter: "alpha",
        operationsSorter: "method",
      },
    })
  );

  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
