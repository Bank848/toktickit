import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';

export const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/health', healthRouter);
