import { useMemo, useState } from "react";
import { Plus, ArrowLeft, FileText, FilePlus, Loader2 } from "lucide-react";
import type { PendingChange, BlogPost } from "@/lib/types";
import { getByPath, asString } from "@/lib/content-paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";

const EMPTY_POST: BlogPost = {
  title: "",
  slug: "",
  date: "",
  author: "",
  cover: "",
  body: "",
};

interface BlogPanelProps {
  content: unknown;
  /** Why content.json could not be read, if it could not. */
  contentError?: string | null;
  pendingChanges: PendingChange[];
  saving: boolean;
  /** Edit one field of an existing post: persists + previews live. */
  onEditField: (field: string, oldValue: unknown, newValue: unknown) => void;
  /** Add a brand-new post: persists as blog_post_add + previews via template clone. */
  onAddPost: (post: BlogPost) => void;
}

export function BlogPanel({
  content,
  contentError,
  pendingChanges,
  saving,
  onEditField,
  onAddPost,
}: BlogPanelProps) {
  const [mode, setMode] = useState<"list" | "new" | { editIndex: number }>("list");

  const existingPosts = useMemo<BlogPost[]>(() => {
    const arr = getByPath(content, "blog.posts");
    return Array.isArray(arr) ? (arr as BlogPost[]) : [];
  }, [content]);

  const newPosts = useMemo(
    () => pendingChanges.filter((c) => c.changeType === "blog_post_add"),
    [pendingChanges]
  );

  // Effective value of a post field, honoring any pending field edit.
  function effective(index: number, key: keyof BlogPost): string {
    const field = `blog.posts[${index}].${key}`;
    const pending = pendingChanges.find(
      (c) => c.changeType === "field" && c.field === field
    );
    if (pending) return asString(pending.newValue);
    return asString(existingPosts[index]?.[key]);
  }

  if (mode === "new") {
    return (
      <PostForm
        title="New post"
        initial={EMPTY_POST}
        saving={saving}
        onBack={() => setMode("list")}
        onSubmit={(post) => {
          onAddPost(post);
          setMode("list");
        }}
      />
    );
  }

  if (typeof mode === "object") {
    const i = mode.editIndex;
    const current: BlogPost = {
      title: effective(i, "title"),
      slug: effective(i, "slug"),
      date: effective(i, "date"),
      author: effective(i, "author"),
      cover: effective(i, "cover"),
      body: effective(i, "body"),
    };
    return (
      <PostForm
        title={`Edit: ${current.title || "post"}`}
        initial={current}
        saving={saving}
        onBack={() => setMode("list")}
        onSubmit={(post) => {
          (Object.keys(post) as (keyof BlogPost)[]).forEach((key) => {
            const oldVal = asString(existingPosts[i]?.[key]);
            if (post[key] !== oldVal) {
              onEditField(`blog.posts[${i}].${key}`, existingPosts[i]?.[key] ?? "", post[key]);
            }
          });
          setMode("list");
        }}
      />
    );
  }

  // ── List mode ──
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">Blog posts</p>
        <Button size="sm" onClick={() => setMode("new")}>
          <Plus className="h-4 w-4" /> Add post
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {contentError ? (
          // Distinguish "this site has no posts" from "the posts could not be
          // loaded" — otherwise a missing GITHUB_TOKEN looks like an empty blog.
          <div className="p-4">
            <EmptyState
              title="Existing posts couldn't be loaded"
              description={`content.json could not be read from GitHub, so posts already published aren't listed. ${contentError}`}
            />
          </div>
        ) : existingPosts.length === 0 && newPosts.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No posts yet" description="Add your first blog post." />
          </div>
        ) : (
          <div className="divide-y">
            {existingPosts.map((_, i) => (
              <button
                key={`existing-${i}`}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/40"
                onClick={() => setMode({ editIndex: i })}
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {effective(i, "title") || "Untitled"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {effective(i, "date")}
                    {effective(i, "author") ? ` · ${effective(i, "author")}` : ""}
                  </p>
                </div>
              </button>
            ))}
            {newPosts.map((c) => {
              const post = c.newValue as BlogPost;
              return (
                <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                  <FilePlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {post?.title || "Untitled"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {post?.date}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    New
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PostForm({
  title,
  initial,
  saving,
  onBack,
  onSubmit,
}: {
  title: string;
  initial: BlogPost;
  saving: boolean;
  onBack: () => void;
  onSubmit: (post: BlogPost) => void;
}) {
  const [post, setPost] = useState<BlogPost>(initial);
  const set = (key: keyof BlogPost, value: string) =>
    setPost((p) => ({ ...p, [key]: value }));

  const valid = post.title.trim() && post.slug.trim();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="truncate text-sm font-medium">{title}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <Field label="Title">
          <Input value={post.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Slug">
          <Input
            value={post.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="my-first-post"
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={post.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Author">
          <Input value={post.author} onChange={(e) => set("author", e.target.value)} />
        </Field>
        <Field label="Cover image URL">
          <Input
            value={post.cover}
            onChange={(e) => set("cover", e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Body (markdown)">
          <Textarea
            value={post.body}
            onChange={(e) => set("body", e.target.value)}
            rows={10}
          />
        </Field>
      </div>

      <div className="border-t p-4">
        <Button className="w-full" disabled={!valid || saving} onClick={() => onSubmit(post)}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save post
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
