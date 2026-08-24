import { useEffect, useState } from "react";
import { Loader2, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useMe } from "@/lib/me";
import type { Me } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/** Self-service account settings: display name and password. */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const api = useApi();
  const { me, setMe } = useMe();
  const [name, setName] = useState(me?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Re-seed from the profile each time it opens, so a cancelled edit is discarded.
  useEffect(() => {
    if (open) setName(me?.name ?? "");
  }, [open, me?.name]);

  const dirty = name.trim() !== (me?.name ?? "").trim();

  async function saveName() {
    setSaving(true);
    try {
      const updated = await api.patch<Me>("/api/me", { name: name.trim() });
      setMe(updated);
      toast.success("Name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your name");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setSending(true);
    try {
      await api.post<{ sent: boolean }>("/api/account/password");
      toast.success(`Check ${me?.email} for a link to set a new password`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the email");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Your account details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{me?.email}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your email identifies the account and can't be changed here.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Password</Label>
            {me?.hasPassword ? (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={changePassword}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  Email me a link to change it
                </Button>
                <p className="text-xs text-muted-foreground">
                  You set the new password on Auth0's own page — Mirantic never handles it.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                You sign in with Google, so there's no Mirantic password to change.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={saveName} disabled={!dirty || !name.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
