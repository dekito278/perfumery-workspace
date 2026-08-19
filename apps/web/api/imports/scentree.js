import { createImportHandler } from './_handler.js';
import { importScentreeByUrl } from '../../src/utils/materialImportScrapers.js';

export default createImportHandler({ allowGet: false, scrape: importScentreeByUrl });
