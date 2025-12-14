import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

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

async function runPythonPipeline(payload: unknown[]) {
  const tmpDir = path.resolve(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });

  const inputPath = path.join(tmpDir, `input-${Date.now()}.json`);
  const outputPath = path.join(tmpDir, `qdrant-${Date.now()}.json`);
  const pipelinePath =
    process.env.PIPELINE_PATH ||
    path.resolve(process.cwd(), 'src', 'pipeline.py');
  const venvPython = path.resolve(process.cwd(), '.venv', 'bin', 'python3');
  const pythonExecutable =
    process.env.PYTHON_BIN ||
    (await fs
      .access(venvPython)
      .then(() => venvPython)
      .catch(() => 'python3'));
  const provider = process.env.PIPELINE_PROVIDER || 'openai';

  await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), 'utf8');

  const args = [
    pipelinePath,
    '--input',
    inputPath,
    '--output',
    outputPath,
    process.env.PIPELINE_SKIP_EMBEDDINGS === 'false' ? '' : '--skip-embeddings',
    '--provider',
    provider,
  ].filter(Boolean);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(pythonExecutable, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pipeline.py exited with code ${code}`));
    });
  });

  const transformedRaw = await fs.readFile(outputPath, 'utf8');
  const transformedDocs = JSON.parse(transformedRaw) as QdrantDocument[];
  return { transformedDocs, outputPath };
}

app.post('/api/pipeline', async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected an array of CMS documents' });
  }
  try {
    const { transformedDocs, outputPath } = await runPythonPipeline(req.body);
    documents = transformedDocs;
    res.status(201).json({
      stored: documents.length,
      outputPath,
      message: 'Pipeline completed',
      documents: transformedDocs,
    });
  } catch (error: any) {
    console.error('Pipeline error', error);
    res.status(500).json({ error: error?.message || 'Pipeline failed' });
  }
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
