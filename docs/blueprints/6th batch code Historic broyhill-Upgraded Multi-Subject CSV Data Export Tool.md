Upgraded Multi-Subject CSV Data Export Tool

This upgraded export script allows the **Office Complex Manager** and the **Event Center Marketing & Operations Manager** to generate target-filtered reports. Instead of exporting the entire database, they can filter by `intentSubject` or `eventType` directly from the command line interface (CLI) to pull high-fidelity datasets for spreadsheet analysis.

Save this file as `scripts/export-leads-filtered.ts` in your project root:

typescript

```
import { PrismaClient, IntentSubject } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExportFilters {
  subject?: IntentSubject;
  eventType?: string;
}

async function exportLeadsFiltered() {
  // Parse command line arguments passed by the managers
  const args = process.argv.slice(2);
  const filters: ExportFilters = {};

  args.forEach(arg => {
    if (arg.startsWith('--subject=')) {
      const sub = arg.split('=')[1];
      if (sub === 'COMMERCIAL_LEASE' || sub === 'CONFERENCE_EVENT') {
        filters.subject = sub as IntentSubject;
      }
    }
    if (arg.startsWith('--type=')) {
      filters.eventType = arg.split('=')[1]; // e.g., WEDDING, CHAMBER_OF_COMMERCE
    }
  });

  console.log(`🔍 Executing lead export with active criteria filters: ${JSON.stringify(filters)}`);

  // 1. Build dynamic query structure based on manager requirements
  const queryCondition: any = {};
  if (filters.subject) queryCondition.intentSubject = filters.subject;
  if (filters.eventType) queryCondition.eventType = filters.eventType;

  // 2. Pull isolated CRM footprints from the database
  const targetedLeads = await prisma.leadProfile.findMany({
    where: queryCondition,
    orderBy: { leadScore: 'desc' },
  });

  if (targetedLeads.length === 0) {
    console.log('⚠️ No matching prospect data profiles located. Export execution stopped.');
    return;
  }

  // 3. Assemble structural file content
  const headers = [
    'Lead ID', 'Email Address', 'Company/Client Name', 'Phone',
    'Lead Score', 'Pipeline Status', 'Intent Subject', 'Event Classification',
    'Square Footage Target', 'Budget Parameter', 'Sourcing Channel', 'Creation Timestamp'
  ];

  const rows = targetedLeads.map(lead => [
    `"${lead.id}"`,
    `"${lead.email}"`,
    `"${lead.companyName || ''}"`,
    `"${lead.phone || ''}"`,
    lead.leadScore,
    `"${lead.leadStatus}"`,
    `"${lead.intentSubject}"`,
    `"${lead.eventType || ''}"`,
    lead.targetSquareFt || '',
    lead.targetBudget || '',
    `"${lead.leadSource}"`,
    `"${lead.createdAt.toISOString()}"`
  ].join(','));

  const filePayload = [headers.join(','), ...rows].join('\n');

  // 4. Mount directory path infrastructure and save artifact
  const exportDir = path.join(__dirname, '../packages/database/exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Generate customized names based on filters to keep files organized for managers
  const filterLabel = filters.eventType ? filters.eventType.toLowerCase() : filters.subject ? filters.subject.toLowerCase() : 'master';
  const targetFilename = `crm_${filterLabel}_prospects_${Date.now()}.csv`;
  const fullOutputPath = path.join(exportDir, targetFilename);

  fs.writeFileSync(fullOutputPath, filePayload, 'utf8');
  console.log(`\n✅ Customized spreadsheet compilation generated successfully:`);
  console.log(`   📂 File Saved: ${fullOutputPath}`);
}

exportLeadsFiltered()
  .catch(err => {
    console.error(

'❌ Data extraction system runtime issue: ', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.\$disconnect();
  });
```

Use code with caution.

------

💻 Quick-Run Script Triggers for Managers

To make these script parameters simple for non-technical building operators to trigger inside their console terminals, assign these shortcuts inside your root **`package.json`** file under the `"scripts"` matrix block:

json

```
"export:weddings": "ts-node scripts/export-leads-filtered.ts --subject=CONFERENCE_EVENT --type=WEDDING",
"export:chamber": "ts-node scripts/export-leads-filtered.ts --subject=CONFERENCE_EVENT --type=CHAMBER_OF_COMMERCE",
"export:vacancies": "ts-node scripts/export-leads-filtered.ts --subject=COMMERCIAL_LEASE --type=VACANT_OFFICE"
```

Use code with caution.

Running the Custom Filters:

- **The Event Center Manager** pulls all current high-ticket wedding lists by running:

  bash

  ```
  npm run export:weddings
  ```

  Use code with caution.

- **The Office Complex Manager** dumps all current real estate prospect lists targeting vacant square footage by running:

  bash

  ```
  npm run export:vacancies
  ```

  Use code with caution.

The system will isolate the records, calculate sorting bounds by highest lead score metrics first, and save a clean, upload-ready `.csv` file directly inside your database project folder assets layer.

------

The entire platform code pack and filter configurations are fully built out. If you're interested, I can:

- Propose an **automated dashboard component configuration** to allow your team to download these filtered CSVs directly from the web panel UI without using the terminal.
- Show how to integrate a **Postman test script** to verify the data structure of the API endpoint that drops these files.

Let me know if you would like me to map out one of these features next!