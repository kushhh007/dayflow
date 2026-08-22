import express from 'express';
import { authRouter } from './routes/auth.routes.js';
import { attendanceRouter } from './routes/attendance.routes.js';
import { employeeRouter } from './routes/employee.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { leaveRouter } from './routes/leave.routes.js';
import { metaRouter } from './routes/meta.routes.js';
import { payslipRouter, payrollRouter } from './routes/payroll.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/payslips', payslipRouter);
app.use('/', metaRouter);
app.use('/api/health', healthRouter);
app.use(errorHandler);

export default app;
