import { Router } from 'express';
import healthCheck from './health-check.js';
import scentreeImport from './scentree-import.js';

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.post('/imports/scentree', scentreeImport);

    return router;
};
