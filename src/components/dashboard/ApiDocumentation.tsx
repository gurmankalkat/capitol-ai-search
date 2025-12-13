import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Play, Server, Database, Box, Zap } from "lucide-react";

const endpoints = [
  {
    method: "POST",
    path: "/api/v1/ingest",
    description: "Ingest raw documents for processing",
    body: `{
  "source": "customer_api",
  "documents": [
    {
      "id": "doc_123",
      "content": "...",
      "metadata": {...}
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/documents",
    description: "Retrieve processed documents with embeddings",
    body: `// Query params
?limit=50
&offset=0
&website=nj
&section=News`,
  },
  {
    method: "POST",
    path: "/api/v1/search",
    description: "Semantic search across vector embeddings",
    body: `{
  "query": "weather forecast",
  "limit": 10,
  "threshold": 0.7
}`,
  },
  {
    method: "GET",
    path: "/api/v1/pipeline/status",
    description: "Check pipeline health and processing queue",
    body: `// Response
{
  "status": "healthy",
  "queue_depth": 0,
  "processed_today": 1250
}`,
  },
];

const dockerConfig = `# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`;

const composeConfig = `# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - QDRANT_URL=http://qdrant:6333
      - OPENAI_API_KEY=\${OPENAI_API_KEY}
    depends_on:
      - qdrant

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  qdrant_data:`;

export function ApiDocumentation() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'api' | 'docker' | 'architecture'>('api');

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { id: 'api', label: 'REST API', icon: Server },
          { id: 'docker', label: 'Docker', icon: Box },
          { id: 'architecture', label: 'Architecture', icon: Database },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'api' && (
          <div className="space-y-4">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Ingestion API Endpoints</h3>
              <p className="text-sm text-muted-foreground">
                RESTful API for document ingestion, processing, and semantic search
              </p>
            </div>
            
            {endpoints.map((endpoint, index) => (
              <div
                key={index}
                className="group rounded-lg border border-border bg-muted/30 overflow-hidden transition-colors hover:border-primary/30"
              >
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={endpoint.method === 'GET' ? 'info' : 'success'}
                      className="font-mono text-xs"
                    >
                      {endpoint.method}
                    </Badge>
                    <code className="font-mono text-sm text-foreground">{endpoint.path}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(endpoint.body, index)}
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      <Play className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">{endpoint.description}</p>
                  <pre className="text-xs font-mono bg-background/50 p-3 rounded-md overflow-x-auto text-muted-foreground">
                    {endpoint.body}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'docker' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Container Configuration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Production-ready Docker setup with Qdrant vector database
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
                  <span className="font-mono text-sm text-foreground">Dockerfile</span>
                  <button
                    onClick={() => copyToClipboard(dockerConfig, 100)}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedIndex === 100 ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-muted-foreground overflow-x-auto">
                  {dockerConfig}
                </pre>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
                  <span className="font-mono text-sm text-foreground">docker-compose.yml</span>
                  <button
                    onClick={() => copyToClipboard(composeConfig, 101)}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedIndex === 101 ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-muted-foreground overflow-x-auto">
                  {composeConfig}
                </pre>
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground mb-1">Quick Start</h4>
                  <code className="text-sm font-mono text-muted-foreground">
                    docker-compose up -d
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">System Architecture</h3>
              <p className="text-sm text-muted-foreground mb-6">
                High-level overview of the data ingestion pipeline
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              {[
                { icon: Server, label: 'REST API', desc: 'FastAPI / Express' },
                { icon: Zap, label: 'Processor', desc: 'Async Queue' },
                { icon: Database, label: 'Qdrant', desc: 'Vector Store' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex flex-col items-center p-4 rounded-xl border border-border bg-muted/30 min-w-[120px]">
                    <div className="p-3 rounded-lg bg-primary/10 mb-2">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.desc}</span>
                  </div>
                  {i < 2 && (
                    <div className="text-muted-foreground text-2xl">→</div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Embedding Model', value: 'text-embedding-3-small', detail: 'OpenAI' },
                { title: 'Vector Dimensions', value: '1536', detail: 'per document' },
                { title: 'Similarity Metric', value: 'Cosine', detail: 'distance' },
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">{item.title}</p>
                  <p className="font-mono font-semibold text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
