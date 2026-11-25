import { RECORD_SOURCES } from '../models/Record.js';
import { parseCsv } from './csvStore.js';
import { RecordValidationError, persistRecord } from './recordStore.js';

function cell(row, index) {
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

export async function importRecordsFromCsv(csvText, config) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return { imported: 0, skipped: 0, errors: ['CSV has no data rows.'] };
  }

  const header = rows[0].map((value) => value.replace(/^\uFEFF/, '').trim().toLowerCase());
  const indexOf = (name) => header.indexOf(name);

  if (indexOf('timestamp') === -1) {
    return {
      imported: 0,
      skipped: 0,
      errors: ['CSV is missing the required "timestamp" column.'],
    };
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const source = (cell(row, indexOf('source')) || 'guest').toLowerCase();

    try {
      if (!RECORD_SOURCES.includes(source)) {
        throw new RecordValidationError(`Unknown source "${source}".`, 'source');
      }

      const timestamp = new Date(cell(row, indexOf('timestamp')));
      if (Number.isNaN(timestamp.getTime())) {
        throw new RecordValidationError('Invalid timestamp.', 'timestamp');
      }

      await persistRecord(
        {
          name: cell(row, indexOf('name')),
          phone: cell(row, indexOf('phone')),
          email: cell(row, indexOf('email')),
          reward: cell(row, indexOf('reward')),
          timestamp,
          source,
        },
        config,
        { dedupe: false }
      );
      imported += 1;
    } catch (error) {
      skipped += 1;
      errors.push(`Row ${rowIndex + 1}: ${error.message}`);
    }
  }

  return { imported, skipped, errors: errors.slice(0, 20) };
}
