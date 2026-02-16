import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import handler from './api/claude.js';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.post('/api/claude', async (req, res) => {
    try {
        await handler(req, res);
    } catch (error) {
        console.error('Proxy server error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
