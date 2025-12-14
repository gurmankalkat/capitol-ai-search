import { useMemo, useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DocumentCard } from "@/components/dashboard/DocumentCard";
import { EmbeddingVisualizer } from "@/components/dashboard/EmbeddingVisualizer";
import { useDocuments } from "@/hooks/useDocuments";
import { apiUrl } from "@/lib/api";
import { QdrantDocument, PipelineStats } from "@/types/document";
import { 
  FileText, 
  Cpu, 
  Globe, 
  Search,
  Grid3X3,
  List,
  Upload,
  FileJson,
  Download,
  AlertTriangle,
  Code,
  Copy,
  Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DEFAULT_EMBEDDING_DIMENSION = 32;

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)];
};

const normalizeDate = (value: unknown) => {
  if (!value) return new Date().toISOString();
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const computeStats = (docs: QdrantDocument[]): PipelineStats | null => {
  if (docs.length === 0) return null;

  const embeddingDim = docs[0]?.embedding?.length || 0;
  const magnitudes = docs.map(doc => {
    const sum = doc.embedding.reduce((acc, val) => acc + val * val, 0);
    return Math.sqrt(sum);
  });
  const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;

  const websites = new Set(docs.map(d => d.metadata.website));
  const allSections = docs.flatMap(d => d.metadata.sections);
  const uniqueSections = [...new Set(allSections)];

  const dates = docs
    .map(d => new Date(d.metadata.publish_date))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    totalDocuments: docs.length,
    processedDocuments: docs.length,
    embeddingDimension: embeddingDim,
    avgEmbeddingMagnitude: avgMagnitude,
    uniqueWebsites: websites.size,
    uniqueSections,
    dateRange: {
      earliest: dates[0]?.toISOString().split('T')[0] || 'N/A',
      latest: dates[dates.length - 1]?.toISOString().split('T')[0] || 'N/A',
    },
  };
};

const cmsRecordToQdrant = (item: Record<string, unknown>, index: number): QdrantDocument => {
  // Check if already in Qdrant format
  if (
    item && 
    typeof item === 'object' && 
    'text' in item && 
    'metadata' in item && 
    'embedding' in item
  ) {
    return item as unknown as QdrantDocument;
  }

  const text = String(
    (item as any)?.text ||
    (item as any)?.body ||
    (item as any)?.content ||
    (item as any)?.summary ||
    ''
  ) || 'No content provided';

  const published =
    (item as any)?.publish_date ||
    (item as any)?.published_at ||
    (item as any)?.datetime ||
    (item as any)?.created_at ||
    (item as any)?.updated_at;

  const title =
    (item as any)?.title ||
    (item as any)?.headline ||
    (item as any)?.name ||
    'Untitled';

  const embeddingCandidate = (item as any)?.embedding || (item as any)?.vector;
  const embedding =
    Array.isArray(embeddingCandidate) && embeddingCandidate.every((val) => typeof val === 'number')
      ? embeddingCandidate
      : Array(DEFAULT_EMBEDDING_DIMENSION).fill(0);

  return {
    text,
    metadata: {
      title,
      url: (item as any)?.url || (item as any)?.link || '#',
      external_id:
        (item as any)?.external_id ||
        (item as any)?.id ||
        (item as any)?.slug ||
        (item as any)?.uuid ||
        `cms-${index}`,
      publish_date: normalizeDate(published),
      datetime: normalizeDate(published),
      first_publish_date: normalizeDate(
        (item as any)?.first_publish_date || published
      ),
      website: (item as any)?.website || (item as any)?.site || (item as any)?.source || 'cms',
      sections: toStringArray(
        (item as any)?.sections ||
        (item as any)?.section ||
        (item as any)?.category ||
        (item as any)?.categories
      ),
      categories: toStringArray((item as any)?.categories || (item as any)?.category),
      tags: toStringArray((item as any)?.tags || (item as any)?.keywords || (item as any)?.labels),
      thumb: (item as any)?.thumb || (item as any)?.thumbnail || (item as any)?.image || (item as any)?.featured_image || '',
    },
    embedding,
  };
};

const Index = () => {
  const { documents, loading, error, stats } = useDocuments();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<QdrantDocument[]>([]);
  const [convertedJson, setConvertedJson] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'ready'>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeDocuments = uploadedDocuments.length ? uploadedDocuments : documents;
  const activeStats = useMemo(() => {
    if (uploadedDocuments.length) return computeStats(uploadedDocuments);
    return stats;
  }, [uploadedDocuments, stats]);
  const showLoading = loading && uploadedDocuments.length === 0;

  const filteredDocuments = activeDocuments.filter(doc => {
    const matchesSearch = searchQuery === "" || 
      doc.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSection = !selectedSection || doc.metadata.sections.includes(selectedSection);
    return matchesSearch && matchesSection;
  });

  const handleCmsUpload = async (file: File) => {
    try {
      setUploadError(null);
      setUploadStatus('processing');
      setUploadedFileName(file.name);
      setConvertedJson(null);
      setUploadedDocuments([]);

      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed)
        ? parsed
        : parsed.items || parsed.data || parsed.results || parsed.documents;

      if (!Array.isArray(items)) {
        throw new Error('Expected an array of CMS records or a top-level "items"/"data" array.');
      }

      const response = await fetch(apiUrl('/api/pipeline'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(items),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Pipeline error: ${response.status} ${errorBody}`);
      }

      const payload = await response.json();
      const transformed = (payload as any)?.documents as QdrantDocument[] | undefined;

      if (!transformed || !Array.isArray(transformed) || !transformed.length) {
        throw new Error('Pipeline did not return transformed documents.');
      }

      setUploadedDocuments(transformed);
      setConvertedJson(JSON.stringify(transformed, null, 2));
      setSelectedSection(null);
      setSearchQuery("");
      setUploadStatus('ready');
    } catch (err) {
      setUploadStatus('idle');
      setUploadedDocuments([]);
      setConvertedJson(null);
      setUploadError(err instanceof Error ? err.message : 'Unable to parse file. Please upload valid JSON.');
    }
  };

  const handleDownload = () => {
    if (!convertedJson) return;
    const blob = new Blob([convertedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = uploadedFileName
      ? uploadedFileName.replace(/\.json$/i, "") + "_qdrant.json"
      : "qdrant_documents.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/json") {
      handleCmsUpload(file);
    } else {
      setUploadError("Please drop a valid JSON file.");
    }
  };

  const handleCopyJson = async () => {
    if (!convertedJson) return;
    await navigator.clipboard.writeText(convertedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate preview JSON (first 2 docs, truncated embeddings)
  const previewJson = useMemo(() => {
    if (uploadedDocuments.length === 0) return null;
    const preview = uploadedDocuments.slice(0, 2).map(doc => ({
      ...doc,
      text: doc.text.length > 150 ? doc.text.slice(0, 150) + "..." : doc.text,
      embedding: [...doc.embedding.slice(0, 4), "...", doc.embedding.slice(-2)]
    }));
    return JSON.stringify(preview, null, 2);
  }, [uploadedDocuments]);

  if (error && uploadedDocuments.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Error loading documents</p>
          <p className="text-muted-foreground text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark">
      <Header isLoading={loading} />

      <main className="container mx-auto px-6 py-8">
        {/* Hero section */}
        <section className="mb-12 animate-fade-in">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-12">
            <div className="absolute inset-0 grid-pattern opacity-50" />
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
            
            <div className="relative">
              <Badge variant="info" className="mb-4">Capitol AI Assessment</Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Data Ingestion Pipeline
              </h1>
              <p className="text-muted-foreground max-w-2xl text-lg">
                Transform customer API data into standardized Qdrant documents with vector embeddings 
                for semantic search capabilities.
              </p>
            </div>
          </div>
        </section>

        {/* CMS Upload & Conversion */}
        <section className="mb-10">
          <div 
            className={`rounded-2xl border-2 border-dashed bg-card p-6 min-h-[50vh] transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-muted-foreground/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col gap-4">
              {/* Header with upload button */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileJson className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">CMS → Qdrant Converter</h3>
                    <p className="text-sm text-muted-foreground">
                      Drop a JSON file here or click to browse
                    </p>
                  </div>
                </div>
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition-colors">
                  <Upload className="h-4 w-4" />
                  <span>{uploadStatus === 'processing' ? 'Processing...' : 'Browse Files'}</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleCmsUpload(file);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>

              {/* Drag indicator */}
              {isDragging && (
                <div className="flex items-center justify-center py-8 text-primary font-medium">
                  <Upload className="h-6 w-6 mr-2 animate-bounce" />
                  Drop your JSON file here
                </div>
              )}

              {uploadError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">Upload failed</p>
                    <p className="text-xs text-destructive/90">{uploadError}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="text-sm font-semibold text-foreground">
                    {uploadStatus === 'processing'
                      ? 'Parsing CMS file...'
                      : uploadStatus === 'ready'
                        ? 'Ready to download'
                        : 'Waiting for upload'}
                  </p>
                  {uploadedFileName && (
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                      {uploadedFileName}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Converted Docs</p>
                  <p className="text-sm font-semibold text-foreground">
                    {uploadedDocuments.length || '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Using {uploadedDocuments.length ? 'uploaded data' : 'sample dataset'}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Embedding Dimensions</p>
                  <p className="text-sm font-semibold text-foreground">
                    {uploadedDocuments.length
                      ? uploadedDocuments[0]?.embedding.length
                      : stats?.embeddingDimension || '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Defaults to {DEFAULT_EMBEDDING_DIMENSION} if none provided
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Expecting an array at the root (or under <code>items</code>/<code>data</code>) with keys like <code>id</code>, <code>title</code>, <code>content</code>, <code>published_at</code>, <code>tags</code>.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    disabled={!convertedJson}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download Qdrant JSON
                  </button>
                  {convertedJson && (
                    <Badge variant="success" className="text-xs">
                      {uploadedDocuments.length} docs ready
                    </Badge>
                  )}
                </div>
              </div>

              {/* JSON Preview Panel */}
              {previewJson && (
                <div className="mt-4 rounded-lg border border-border bg-muted/30 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Code className="h-4 w-4 text-primary" />
                      Output Preview
                      <span className="text-xs text-muted-foreground font-normal">
                        (showing {Math.min(2, uploadedDocuments.length)} of {uploadedDocuments.length} docs)
                      </span>
                    </div>
                    <button
                      onClick={handleCopyJson}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy All
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-muted-foreground overflow-x-auto max-h-64 overflow-y-auto">
                    <code>{previewJson}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        {activeStats && (
          <section className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Total Documents"
              value={activeStats.totalDocuments}
              icon={FileText}
              description="Processed and indexed"
              delay={0}
            />
            <StatsCard
              title="Embedding Dimensions"
              value={activeStats.embeddingDimension}
              icon={Cpu}
              description="Vector size per document"
              delay={100}
            />
            <StatsCard
              title="Data Sources"
              value={activeStats.uniqueWebsites}
              icon={Globe}
              description={`${activeStats.dateRange.earliest} → ${activeStats.dateRange.latest}`}
              delay={200}
            />
          </section>
        )}

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 space-y-6">
            {/* Embedding visualizer */}
            <EmbeddingVisualizer documents={activeDocuments} />
          </div>
        </div>

        {/* Documents Section */}
        <section>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Indexed Documents</h2>
              <p className="text-sm text-muted-foreground">
                {filteredDocuments.length} of {activeDocuments.length} documents
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>

            </div>
          </div>

          {showLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-4"
            }>
              {filteredDocuments.slice(0, 12).map((doc, index) => (
                <DocumentCard key={doc.metadata.external_id} document={doc} index={index} />
              ))}
            </div>
          )}

          {filteredDocuments.length > 12 && (
            <div className="mt-8 text-center">
              <button className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                Load More ({filteredDocuments.length - 12} remaining)
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="container mx-auto px-6 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Capitol AI Data Pipeline • Built with Qdrant Vector Database
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
