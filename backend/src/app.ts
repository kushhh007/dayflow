import express from 'express';
import { healthRouter } from './routes/health.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());
app.use('/api/health', healthRouter);
app.use(errorHandler);

export default app;
