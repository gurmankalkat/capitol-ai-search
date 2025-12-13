import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface PipelineStatusProps {
  processedCount: number;
  totalCount: number;
}

export function PipelineStatus({ processedCount, totalCount }: PipelineStatusProps) {
  const progress = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;
  const isComplete = processedCount === totalCount;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isComplete ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <Activity className="h-5 w-5 text-primary animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Pipeline Status</h3>
            <p className="text-xs text-muted-foreground">Real-time processing status</p>
          </div>
        </div>
        <Badge variant={isComplete ? 'success' : 'info'}>
          {isComplete ? 'Completed' : 'Processing'}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-mono text-foreground">{processedCount} / {totalCount}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status items */}
      <div className="space-y-2">
        {[
          { icon: CheckCircle, label: 'Text Extraction', status: 'complete', color: 'text-emerald-400' },
          { icon: CheckCircle, label: 'Metadata Mapping', status: 'complete', color: 'text-emerald-400' },
          { icon: CheckCircle, label: 'Embedding Generation', status: 'complete', color: 'text-emerald-400' },
          { icon: CheckCircle, label: 'Vector Storage', status: 'complete', color: 'text-emerald-400' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <item.icon className={`h-4 w-4 ${item.color}`} />
            <span className="text-muted-foreground">{item.label}</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {item.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
