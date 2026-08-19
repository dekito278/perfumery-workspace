import { createImportHandler } from './_handler.js';
import { importPerfumersWorldByUrl } from '../../src/utils/materialImportScrapers.js';

export default createImportHandler({ allowGet: true, scrape: importPerfumersWorldByUrl });
