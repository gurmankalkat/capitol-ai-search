import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

type QdrantDocument = {
  text: string;
  embedding: number[];
  metadata: {
    title: string;
    url: string;
    external_id: string;
    publish_date: string;
    datetime: string;
    first_publish_date: string;
    website: string;
    sections: string[];
    categories: string[];
    tags: string[];
    thumb?: string;
  };
};

const app = express();
const port = Number(process.env.PORT) || 4000;
const dataPath =
  process.env.DATA_PATH ||
  path.resolve(process.cwd(), '../public/data/qdrant_documents.json');

let documents: QdrantDocument[] = [];

app.use(cors());
app.use(express.json({ limit: '5mb' }));

async function loadSeedData() {
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      documents = parsed;
      console.log(`Loaded ${documents.length} documents from ${dataPath}`);
    } else {
      console.warn(`Expected an array in ${dataPath}, got ${typeof parsed}`);
    }
  } catch (error) {
    console.warn(`Unable to read seed data at ${dataPath}:`, error);
  }
}

loadSeedData();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/documents', (_req, res) => {
  res.json(documents);
});

app.post('/api/documents', (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array of documents' });
  }
  documents = req.body as QdrantDocument[];
  res.status(201).json({ stored: documents.length });
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
