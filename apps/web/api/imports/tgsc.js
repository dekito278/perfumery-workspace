import { createImportHandler } from './_handler.js';
import { importTgscByUrl } from '../../src/utils/materialImportScrapers.js';

export default createImportHandler({ allowGet: false, scrape: importTgscByUrl });
