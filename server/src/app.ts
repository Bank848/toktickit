import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { categoriesRouter } from './routes/categories';
import { v1Router } from './routes/v1';
import { correlationId, errorEnvelope } from './middleware/errorEnvelope';

export const app = express();

app.use(cors());
app.use(correlationId);
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/v1', v1Router);

app.use(errorEnvelope);
