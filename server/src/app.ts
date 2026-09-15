import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health';
import { categoriesRouter } from './routes/categories';
import { v1Router } from './routes/v1';
import { correlationId, errorEnvelope } from './middleware/errorEnvelope';

export const app = express();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(correlationId);
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/v1', v1Router);

app.use(errorEnvelope);
