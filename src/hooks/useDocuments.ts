import { useState, useEffect, useMemo } from 'react';
import { QdrantDocument, PipelineStats } from '@/types/document';

export function useDocuments() {
  const [documents, setDocuments] = useState<QdrantDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await fetch('/data/qdrant_documents.json');
        if (!response.ok) throw new Error('Failed to fetch documents');
        const data = await response.json();
        setDocuments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  const stats = useMemo<PipelineStats | null>(() => {
    if (documents.length === 0) return null;

    const embeddingDim = documents[0]?.embedding?.length || 0;
    const magnitudes = documents.map(doc => {
      const sum = doc.embedding.reduce((acc, val) => acc + val * val, 0);
      return Math.sqrt(sum);
    });
    const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;

    const websites = new Set(documents.map(d => d.metadata.website));
    const allSections = documents.flatMap(d => d.metadata.sections);
    const uniqueSections = [...new Set(allSections)];

    const dates = documents
      .map(d => new Date(d.metadata.publish_date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      totalDocuments: documents.length,
      processedDocuments: documents.length,
      embeddingDimension: embeddingDim,
      avgEmbeddingMagnitude: avgMagnitude,
      uniqueWebsites: websites.size,
      uniqueSections,
      dateRange: {
        earliest: dates[0]?.toISOString().split('T')[0] || 'N/A',
        latest: dates[dates.length - 1]?.toISOString().split('T')[0] || 'N/A',
      },
    };
  }, [documents]);

  return { documents, loading, error, stats };
}
