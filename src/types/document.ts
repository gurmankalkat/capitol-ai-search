export interface DocumentMetadata {
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
  thumb: string;
}

export interface QdrantDocument {
  text: string;
  metadata: DocumentMetadata;
  embedding: number[];
}

export interface PipelineStats {
  totalDocuments: number;
  processedDocuments: number;
  embeddingDimension: number;
  avgEmbeddingMagnitude: number;
  uniqueWebsites: number;
  uniqueSections: string[];
  dateRange: { earliest: string; latest: string };
}
