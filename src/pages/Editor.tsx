import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { X, Rocket, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import { useCmsBridge } from "@/lib/useCmsBridge";
import { guessFieldType } from "@/lib/content-paths";
import type { FieldType } from "@/lib/cms-protocol";
import type { PendingChange, SiteWithChanges, BlogPost } from "@/lib/types";
import { CenteredSpinner, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldEditor } from "@/components/editor/FieldEditor";
import { ChangesList } from "@/components/editor/ChangesList";
import { BlogPanel } from "@/components/editor/BlogPanel";
import { PublishDialog } from "@/components/editor/PublishDialog";

interface Selection {
  field: string;
  fieldType: FieldType;
  value: string;
}

export default function Editor() {
  const { id = "" } = useParams();
  const api = useApi();

  const { data, loading, error, refetch } = useFetch<SiteWithChanges>(
    (client) => client.get<SiteWithChanges>(`/api/sites/${id}`),
    [id]
  );

  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [publishing, setPublishing] = useState(false);
  // Incremented on every bridge handshake. A boolean would latch on the first
  // page and leave every page navigated to afterwards without init — and so
  // without click listeners or pending-change previews.
  const [connection, setConnection] = useState(0);
  const [bridgeWarning, setBridgeWarning] = useState(false);
  const readyTimeout = useRef<number | null>(null);

  const site = data?.site;
  const canEdit = data?.canEdit ?? false;
  const canPublish = data?.canPublish ?? false;

  // Seed local changes from the fetch.
  useEffect(() => {
    if (data) setChanges(data.pendingChanges);
  }, [data]);

  const onReady = useCallback(() => {
    setConnection((n) => n + 1);
    setBridgeWarning(false);
    if (readyTimeout.current) window.clearTimeout(readyTimeout.current);
  }, []);

  const onFieldClicked = useCallback(
    (field: string, value: string, fieldType: FieldType) => {
      if (!canEdit) return;
      setSelected({ field, fieldType, value });
    },
    [canEdit]
  );

  const bridge = useCmsBridge({ siteUrl: site?.url ?? "", onReady, onFieldClicked });

  // On (re)connect, push all pending changes into the iframe.
  useEffect(() => {
    if (connection === 0) return;
    const fieldChanges = changes
      .filter((c) => c.changeType === "field")
      .map((c) => ({
        field: c.field,
        value: c.newValue,
        fieldType: guessFieldType(c.field, c.newValue),
      }));
    const newPosts = changes
      .filter((c) => c.changeType === "blog_post_add")
      .map((c) => ({ tempId: c.id, post: c.newValue as Record<string, unknown> }));
    bridge.sendInit(fieldChanges, newPosts, editMode);
    // Only re-init on (re)connection, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  // Pushing the mode separately keeps the toggle instant rather than waiting for
  // a reconnect.
  useEffect(() => {
    if (connection === 0) return;
    bridge.setEditMode(editMode);
    if (!editMode) setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, connection]);

  // Warn if the bridge never connects (script missing / wrong origin).
  function handleIframeLoad() {
    if (readyTimeout.current) window.clearTimeout(readyTimeout.current);
    readyTimeout.current = window.setTimeout(() => {
      setConnection((n) => {
        if (n === 0) setBridgeWarning(true);
        return n;
      });
    }, 4000);
  }

  function mergeChange(change: PendingChange) {
    setChanges((prev) => {
      if (change.changeType === "field") {
        return [...prev.filter((c) => c.field !== change.field), change];
      }
      return [...prev.filter((c) => c.id !== change.id), change];
    });
  }

  async function persistField(
    field: string,
    oldValue: unknown,
    newValue: unknown,
    fieldType: FieldType
  ) {
    setSavingField(true);
    try {
      const result = await api.post<
        PendingChange | { reverted: true; id: string } | { noop: true }
      >("/api/changes", {
        siteId: id,
        field,
        changeType: "field",
        oldValue,
        newValue,
      });
      if ("reverted" in result) {
        setChanges((prev) => prev.filter((c) => c.id !== result.id));
      } else if (!("noop" in result)) {
        mergeChange(result);
      }
      bridge.applyChange(field, newValue, fieldType);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingField(false);
    }
  }

  async function handleSaveSelected(value: string) {
    if (!selected) return;
    await persistField(selected.field, selected.value, value, selected.fieldType);
    setSelected(null);
  }

  async function handleDiscard(change: PendingChange) {
    try {
      await api.del(`/api/changes?id=${change.id}`);
      setChanges((prev) => prev.filter((c) => c.id !== change.id));
      if (change.changeType === "blog_post_add") {
        bridge.removeBlogPost(change.id);
      } else {
        bridge.applyChange(
          change.field,
          change.oldValue,
          guessFieldType(change.field, change.newValue)
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not discard");
    }
  }

  async function handleAddPost(post: BlogPost) {
    setSavingField(true);
    try {
      const created = await api.post<PendingChange>("/api/changes", {
        siteId: id,
        field: "blog.posts[+]",
        changeType: "blog_post_add",
        newValue: post,
      });
      mergeChange(created);
      bridge.applyBlogPost(created.id, post as unknown as Record<string, unknown>);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add post");
    } finally {
      setSavingField(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await api.post<{ published: number }>("/api/publish", { siteId: id });
      setChanges([]);
      setPublishOpen(false);
      toast.success(`Published ${res.published} change${res.published === 1 ? "" : "s"} — deploying now`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <CenteredSpinner label="Loading editor…" />
      </div>
    );
  }
  if (error || !site) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <ErrorState message={error ?? "Site not found"} onRetry={refetch} />
        <Button variant="outline" asChild>
          <Link to="/">Back to sites</Link>
        </Button>
      </div>
    );
  }

  const fieldChangeCount = changes.length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-muted/30">
      {/* The site — fills all available space. */}
      <div className="relative flex-1">
        <iframe
          ref={bridge.iframeRef}
          src={site.url}
          title={site.name}
          className="h-full w-full border-0 bg-white"
          onLoad={handleIframeLoad}
        />
      </div>

      {/* Sidebar — fixed width, always visible. */}
      <aside className="flex w-[380px] shrink-0 flex-col border-l bg-background">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link to="/" title="Close editor" aria-label="Close editor">
                <X className="h-4 w-4" />
              </Link>
            </Button>
            <span className="truncate text-sm font-medium">{site.name}</span>
          </div>
          <Button
            size="sm"
            disabled={fieldChangeCount === 0 || !canPublish}
            onClick={() => setPublishOpen(true)}
          >
            <Rocket className="h-4 w-4" />
            Publish
            {fieldChangeCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5">
                {fieldChangeCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* One switch, not a two-way choice: editing is a mode you turn on, and
            off is simply the site behaving normally. */}
        <div className="flex items-start gap-3 border-b px-4 py-3">
          <Switch
            id="edit-mode"
            checked={editMode}
            onCheckedChange={setEditMode}
            disabled={!canEdit}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <Label htmlFor="edit-mode" className="text-sm font-medium">
              Edit mode
            </Label>
            <p className="text-xs text-muted-foreground">
              {editMode
                ? "Click anything on the page to edit it."
                : "Links work normally — browse to the page you want, then switch this on."}
            </p>
          </div>
        </div>

        {!canEdit && (
          <div className="border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            You have view-only access to this site.
          </div>
        )}

        {bridgeWarning && (
          <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Editing bridge not detected. Make sure cms-bridge.js is installed on this
            site and the URL is correct.
          </div>
        )}

        {data?.contentError && site.hasBlog && (
          <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Could not read content.json — the blog list may be incomplete.
          </div>
        )}

        <div className="min-h-0 flex-1">
          {selected ? (
            <FieldEditor
              siteId={id}
              field={selected.field}
              fieldType={selected.fieldType}
              initialValue={selected.value}
              saving={savingField}
              onPreview={(v) => bridge.applyChange(selected.field, v, selected.fieldType)}
              onSave={handleSaveSelected}
              onBack={() => {
                // Revert live preview to the persisted value before leaving.
                const persisted = changes.find((c) => c.field === selected.field);
                bridge.applyChange(
                  selected.field,
                  persisted ? persisted.newValue : selected.value,
                  selected.fieldType
                );
                setSelected(null);
              }}
            />
          ) : (
            /* Changes first, blog beneath it. They are not alternatives — you
               can have pending edits and be writing a post at the same time —
               so tabs hid one behind the other for no reason. */
            <div className="h-full space-y-4 overflow-y-auto pb-4">
              <div>
                <div className="flex items-center gap-2 px-4 pt-3">
                  <p className="text-sm font-medium">Changes</p>
                  {fieldChangeCount > 0 && (
                    <Badge variant="secondary" className="px-1.5">
                      {fieldChangeCount}
                    </Badge>
                  )}
                </div>
                <ChangesList
                  changes={changes}
                  onDiscard={handleDiscard}
                  onSelect={(c) =>
                    setSelected({
                      field: c.field,
                      fieldType: guessFieldType(c.field, c.newValue),
                      value: typeof c.newValue === "string" ? c.newValue : "",
                    })
                  }
                />
              </div>

              {site.hasBlog && (
                <div className="border-t pt-1">
                  <BlogPanel
                    content={data?.content}
                    contentError={data?.contentError ?? null}
                    pendingChanges={changes}
                    saving={savingField}
                    onEditField={(field, oldVal, newVal) =>
                      persistField(field, oldVal, newVal, guessFieldType(field, newVal))
                    }
                    onAddPost={handleAddPost}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        changes={changes}
        publishing={publishing}
        onConfirm={handlePublish}
      />
    </div>
  );
}
