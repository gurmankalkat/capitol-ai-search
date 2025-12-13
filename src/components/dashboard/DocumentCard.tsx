import { QdrantDocument } from "@/types/document";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, Tag, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  document: QdrantDocument;
  index: number;
}

export function DocumentCard({ document, index }: DocumentCardProps) {
  const { metadata, text, embedding } = document;
  const truncatedText = text.length > 200 ? text.slice(0, 200) + "..." : text;
  
  const formattedDate = new Date(metadata.publish_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300",
        "hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 animate-slide-up"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Thumbnail header */}
      {metadata.thumb && (
        <div className="relative h-32 overflow-hidden bg-muted">
          <img
            src={metadata.thumb}
            alt={metadata.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>
      )}

      <div className="p-5">
        {/* Title */}
        <h3 className="mb-2 line-clamp-2 font-semibold text-foreground transition-colors group-hover:text-primary">
          {metadata.title}
        </h3>

        {/* Meta info */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {embedding.length}D
          </span>
          <Badge variant="info" className="text-[10px]">
            {metadata.website}
          </Badge>
        </div>

        {/* Text preview */}
        <p className="mb-4 text-sm text-muted-foreground line-clamp-3 font-mono text-xs leading-relaxed">
          {truncatedText}
        </p>

        {/* Sections & Tags */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {metadata.sections.slice(0, 3).map((section) => (
            <Badge key={section} variant="secondary" className="text-[10px]">
              {section}
            </Badge>
          ))}
          {metadata.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              <Tag className="mr-1 h-2 w-2" />
              {tag}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <code className="text-[10px] text-muted-foreground font-mono">
            {metadata.external_id.slice(0, 12)}...
          </code>
          <a
            href={metadata.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Source
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
