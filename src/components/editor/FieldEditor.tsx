import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Upload, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { FieldType } from "@/lib/cms-protocol";
import { fieldLabel } from "@/lib/content-paths";
import { useApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FieldEditorProps {
  siteId: string;
  field: string;
  fieldType: FieldType;
  initialValue: string;
  saving: boolean;
  onPreview: (value: string) => void;
  onSave: (value: string) => void;
  onBack: () => void;
}

export function FieldEditor({
  siteId,
  field,
  fieldType,
  initialValue,
  saving,
  onPreview,
  onSave,
  onBack,
}: FieldEditorProps) {
  const api = useApi();
  const [value, setValue] = useState(initialValue);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset when a different field is selected.
  useEffect(() => {
    setValue(initialValue);
  }, [field, initialValue]);

  const dirty = value !== initialValue;

  function update(next: string) {
    setValue(next);
    onPreview(next); // live preview in the iframe as they type/change
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { url } = await api.upload<{ url: string }>(
        `/api/upload?siteId=${siteId}&filename=${encodeURIComponent(file.name)}`,
        file
      );
      update(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{fieldLabel(field)}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{field}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {fieldType === "text" ? (
          <div className="space-y-2">
            <Label htmlFor="field-value">Value</Label>
            <Textarea
              id="field-value"
              value={value}
              onChange={(e) => update(e.target.value)}
              rows={6}
              autoFocus
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Image</Label>
            <div className="overflow-hidden rounded-md border bg-muted/30">
              {value ? (
                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                <img
                  src={value}
                  alt="Preview"
                  className="max-h-48 w-full object-contain"
                  onError={(e) => (e.currentTarget.style.opacity = "0.3")}
                />
              ) : (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload image
                </>
              )}
            </Button>

            <div className="space-y-2">
              <Label htmlFor="img-url" className="text-xs text-muted-foreground">
                …or paste an image URL
              </Label>
              <Input
                id="img-url"
                value={value}
                onChange={(e) => update(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <Button
          className="w-full"
          disabled={!dirty || saving || uploading}
          onClick={() => onSave(value)}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save change
        </Button>
      </div>
    </div>
  );
}
