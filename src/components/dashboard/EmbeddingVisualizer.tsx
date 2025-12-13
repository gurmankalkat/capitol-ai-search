import { useMemo } from "react";
import { QdrantDocument } from "@/types/document";

interface EmbeddingVisualizerProps {
  documents: QdrantDocument[];
}

export function EmbeddingVisualizer({ documents }: EmbeddingVisualizerProps) {
  const visualData = useMemo(() => {
    if (documents.length === 0) return [];
    
    // Take first 20 documents and visualize first 50 dimensions
    return documents.slice(0, 20).map((doc, docIndex) => ({
      id: doc.metadata.external_id,
      title: doc.metadata.title.slice(0, 30),
      values: doc.embedding.slice(0, 50),
    }));
  }, [documents]);

  const getColor = (value: number) => {
    // Map value from [-1, 1] to color intensity
    const normalized = (value + 1) / 2; // 0 to 1
    const hue = normalized * 180; // 0 to 180 (cyan to magenta range)
    return `hsl(${172 + hue * 0.5}, 66%, ${40 + normalized * 30}%)`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Embedding Space Visualization</h3>
        <span className="text-xs text-muted-foreground font-mono">
          First 50 dimensions • {visualData.length} documents
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <div className="space-y-1 min-w-fit">
          {visualData.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2">
              <span className="w-24 truncate text-[10px] text-muted-foreground font-mono">
                {doc.id.slice(0, 8)}
              </span>
              <div className="flex gap-px">
                {doc.values.map((val, i) => (
                  <div
                    key={i}
                    className="h-4 w-1.5 rounded-sm transition-all duration-200 hover:scale-y-150"
                    style={{ backgroundColor: getColor(val) }}
                    title={`dim[${i}]: ${val.toFixed(4)}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-3 w-8 rounded" style={{ background: 'linear-gradient(90deg, hsl(172, 66%, 40%), hsl(262, 66%, 55%))' }} />
          <span>-1.0 → +1.0</span>
        </div>
      </div>
    </div>
  );
}
