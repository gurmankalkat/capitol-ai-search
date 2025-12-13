import { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DocumentCard } from "@/components/dashboard/DocumentCard";
import { EmbeddingVisualizer } from "@/components/dashboard/EmbeddingVisualizer";
import { ApiDocumentation } from "@/components/dashboard/ApiDocumentation";
import { PipelineStatus } from "@/components/dashboard/PipelineStatus";
import { useDocuments } from "@/hooks/useDocuments";
import { 
  FileText, 
  Cpu, 
  Layers, 
  Globe, 
  Calendar, 
  Search,
  Filter,
  Grid3X3,
  List
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const { documents, loading, error, stats } = useDocuments();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchQuery === "" || 
      doc.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSection = !selectedSection || doc.metadata.sections.includes(selectedSection);
    return matchesSearch && matchesSection;
  });

  if (error) {
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

        {/* Stats Grid */}
        {stats && (
          <section className="mb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Documents"
              value={stats.totalDocuments}
              icon={FileText}
              description="Processed and indexed"
              delay={0}
            />
            <StatsCard
              title="Embedding Dimensions"
              value={stats.embeddingDimension}
              icon={Cpu}
              description="Vector size per document"
              delay={100}
            />
            <StatsCard
              title="Unique Sections"
              value={stats.uniqueSections.length}
              icon={Layers}
              description="Content categories"
              delay={200}
            />
            <StatsCard
              title="Data Sources"
              value={stats.uniqueWebsites}
              icon={Globe}
              description={`${stats.dateRange.earliest} → ${stats.dateRange.latest}`}
              delay={300}
            />
          </section>
        )}

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2 space-y-6">
            {/* Embedding visualizer */}
            <EmbeddingVisualizer documents={documents} />
            
            {/* API Documentation */}
            <ApiDocumentation />
          </div>
          
          <div className="space-y-6">
            {/* Pipeline Status */}
            <PipelineStatus 
              processedCount={stats?.processedDocuments || 0} 
              totalCount={stats?.totalDocuments || 0} 
            />

            {/* Quick filters */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold text-foreground mb-4">Quick Filters</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSection(null)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    !selectedSection 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
                {stats?.uniqueSections.slice(0, 8).map(section => (
                  <button
                    key={section}
                    onClick={() => setSelectedSection(section)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      selectedSection === section 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {section}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range info */}
            {stats && (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Date Range</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Earliest</span>
                    <span className="font-mono text-foreground">{stats.dateRange.earliest}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Latest</span>
                    <span className="font-mono text-foreground">{stats.dateRange.latest}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Documents Section */}
        <section>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Indexed Documents</h2>
              <p className="text-sm text-muted-foreground">
                {filteredDocuments.length} of {documents.length} documents
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

              {/* View toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
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
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Capitol AI Data Pipeline • Built with Qdrant Vector Database
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="font-mono">v1.0.0</span>
              <span>•</span>
              <a href="#" className="hover:text-foreground transition-colors">Documentation</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
