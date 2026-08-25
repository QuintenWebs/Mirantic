/**
 * Message protocol between the CMS editor (parent window) and the cms-bridge
 * script running inside the client site iframe.
 *
 * The same contract is implemented by public/cms-bridge.js — keep them in sync.
 */

export type FieldType = "text" | "image";

// ── Messages sent FROM the iframe bridge TO the CMS host ──
export type BridgeMessage =
  | { source: "cms-bridge"; type: "ready" }
  | {
      source: "cms-bridge";
      type: "field-clicked";
      field: string;
      value: string;
      fieldType: FieldType;
    };

// ── Messages sent FROM the CMS host TO the iframe bridge ──
export type HostMessage =
  | {
      source: "cms-host";
      type: "init";
      // All pending field changes to apply on load, plus any pending new posts.
      changes: { field: string; value: unknown; fieldType: FieldType }[];
      newPosts: { tempId: string; post: Record<string, unknown> }[];
      // Whether clicks select fields (edit) or follow the site's own links
      // (browse). Sent on every init so it survives navigation inside the site.
      editMode: boolean;
    }
  | { source: "cms-host"; type: "set-edit-mode"; editMode: boolean }
  | {
      source: "cms-host";
      type: "apply-change";
      field: string;
      value: unknown;
      fieldType: FieldType;
    }
  | {
      source: "cms-host";
      type: "apply-blog-post";
      tempId: string;
      post: Record<string, unknown>;
    }
  | { source: "cms-host"; type: "remove-blog-post"; tempId: string }
  | { source: "cms-host"; type: "highlight"; field: string }
  | { source: "cms-host"; type: "clear-highlight" };

export function isBridgeMessage(data: unknown): data is BridgeMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: string }).source === "cms-bridge"
  );
}
