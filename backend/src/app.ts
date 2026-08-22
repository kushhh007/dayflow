import express from 'express';
import { authRouter } from './routes/auth.routes.js';
import { employeeRouter } from './routes/employee.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { metaRouter } from './routes/meta.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/employees', employeeRouter);
app.use('/', metaRouter);
app.use('/api/health', healthRouter);
app.use(errorHandler);

export default app;
