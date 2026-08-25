import { useCallback, useEffect, useRef } from "react";
import {
  isBridgeMessage,
  type BridgeMessage,
  type HostMessage,
  type FieldType,
} from "./cms-protocol";

interface UseCmsBridgeOptions {
  siteUrl: string;
  onReady: () => void;
  onFieldClicked: (field: string, value: string, fieldType: FieldType) => void;
}

/** Loose origin check: accepts the site origin and its www/non-www variant. */
function originMatches(siteUrl: string, origin: string): boolean {
  try {
    const expected = new URL(siteUrl).host.replace(/^www\./, "");
    const got = new URL(origin).host.replace(/^www\./, "");
    return expected === got;
  } catch {
    return false;
  }
}

export function useCmsBridge({ siteUrl, onReady, onFieldClicked }: UseCmsBridgeOptions) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // The actual origin the bridge spoke from, captured on "ready".
  const peerOrigin = useRef<string>("*");
  const onReadyRef = useRef(onReady);
  const onFieldClickedRef = useRef(onFieldClicked);
  onReadyRef.current = onReady;
  onFieldClickedRef.current = onFieldClicked;

  useEffect(() => {
    function handle(event: MessageEvent) {
      if (!isBridgeMessage(event.data)) return;
      // Only trust messages from the site we loaded.
      if (!originMatches(siteUrl, event.origin)) return;

      const msg = event.data as BridgeMessage;
      if (msg.type === "ready") {
        peerOrigin.current = event.origin;
        onReadyRef.current();
      } else if (msg.type === "field-clicked") {
        onFieldClickedRef.current(msg.field, msg.value, msg.fieldType);
      }
    }
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [siteUrl]);

  const send = useCallback((message: HostMessage) => {
    iframeRef.current?.contentWindow?.postMessage(message, peerOrigin.current);
  }, []);

  const sendInit = useCallback(
    (
      changes: { field: string; value: unknown; fieldType: FieldType }[],
      newPosts: { tempId: string; post: Record<string, unknown> }[],
      editMode: boolean
    ) => send({ source: "cms-host", type: "init", changes, newPosts, editMode }),
    [send]
  );

  const setEditMode = useCallback(
    (editMode: boolean) => send({ source: "cms-host", type: "set-edit-mode", editMode }),
    [send]
  );

  const applyChange = useCallback(
    (field: string, value: unknown, fieldType: FieldType) =>
      send({ source: "cms-host", type: "apply-change", field, value, fieldType }),
    [send]
  );

  const applyBlogPost = useCallback(
    (tempId: string, post: Record<string, unknown>) =>
      send({ source: "cms-host", type: "apply-blog-post", tempId, post }),
    [send]
  );

  const removeBlogPost = useCallback(
    (tempId: string) => send({ source: "cms-host", type: "remove-blog-post", tempId }),
    [send]
  );

  const highlight = useCallback(
    (field: string) => send({ source: "cms-host", type: "highlight", field }),
    [send]
  );

  const clearHighlight = useCallback(
    () => send({ source: "cms-host", type: "clear-highlight" }),
    [send]
  );

  return {
    iframeRef,
    sendInit,
    setEditMode,
    applyChange,
    applyBlogPost,
    removeBlogPost,
    highlight,
    clearHighlight,
  };
}
