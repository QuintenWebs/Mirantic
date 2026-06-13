import { Loader2, ArrowRight, FilePlus } from "lucide-react";
import type { PendingChange } from "@/lib/types";
import { fieldLabel, guessFieldType, asString } from "@/lib/content-paths";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: PendingChange[];
  publishing: boolean;
  onConfirm: () => void;
}

function ValuePreview({ value, muted }: { value: unknown; muted?: boolean }) {
  const text = asString(value);
  return (
    <span
      className={
        "block max-w-[14rem] truncate text-xs " +
        (muted ? "text-muted-foreground line-through" : "font-medium")
      }
      title={text}
    >
      {text || "(empty)"}
    </span>
  );
}

export function PublishDialog({
  open,
  onOpenChange,
  changes,
  publishing,
  onConfirm,
}: PublishDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !publishing && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Publish changes</DialogTitle>
          <DialogDescription>
            {changes.length} change{changes.length === 1 ? "" : "s"} will be committed to
            your site and deployed. This goes live.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
          {changes.map((change) => {
            if (change.changeType === "blog_post_add") {
              const post = change.newValue as { title?: string };
              return (
                <div key={change.id} className="flex items-center gap-2 px-3 py-2.5">
                  <FilePlus className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm">
                    New blog post:{" "}
                    <span className="font-medium">{post?.title || "Untitled"}</span>
                  </span>
                </div>
              );
            }
            const isImage = guessFieldType(change.field, change.newValue) === "image";
            return (
              <div key={change.id} className="px-3 py-2.5">
                <p className="text-sm font-medium">{fieldLabel(change.field)}</p>
                {isImage ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">Image updated</p>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <ValuePreview value={change.oldValue} muted />
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <ValuePreview value={change.newValue} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={publishing}>
            {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
            Publish now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
