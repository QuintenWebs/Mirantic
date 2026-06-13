import { Trash2, FileText, ImageIcon, FilePlus } from "lucide-react";
import type { PendingChange } from "@/lib/types";
import { fieldLabel, guessFieldType, asString } from "@/lib/content-paths";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

interface ChangesListProps {
  changes: PendingChange[];
  onDiscard: (change: PendingChange) => void;
  onSelect: (change: PendingChange) => void;
}

export function ChangesList({ changes, onDiscard, onSelect }: ChangesListProps) {
  if (changes.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="No pending changes"
          description="Click any element on your site to edit it. Changes appear here until you publish."
        />
      </div>
    );
  }

  return (
    <div className="divide-y">
      {changes.map((change) => {
        const isNewPost = change.changeType === "blog_post_add";
        const isImage =
          !isNewPost && guessFieldType(change.field, change.newValue) === "image";
        const Icon = isNewPost ? FilePlus : isImage ? ImageIcon : FileText;
        return (
          <div key={change.id} className="group flex items-start gap-3 px-4 py-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => !isNewPost && onSelect(change)}
              disabled={isNewPost}
            >
              <p className="truncate text-sm font-medium">
                {isNewPost
                  ? `New post: ${
                      (change.newValue as { title?: string })?.title || "Untitled"
                    }`
                  : fieldLabel(change.field)}
              </p>
              {!isNewPost && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {isImage ? "Image updated" : asString(change.newValue) || "(empty)"}
                </p>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              title="Discard"
              onClick={() => onDiscard(change)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
