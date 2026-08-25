import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * How to take a site from "just built" to "editable in here". Written from the
 * steps that actually caught us out, not the happy path — the failures are the
 * part worth writing down.
 */
export default function AddSiteGuide() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Adding a site</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Five steps, about ten minutes for a site you've already built.
        </p>
      </div>

      <Step n={1} title="Put the content in one JSON file">
        <p>
          Everything a client may edit lives in a single <Code>content.json</Code>. Components
          import it and render from it, so publishing a change means committing one file — the CMS
          never touches your components, styles or config.
        </p>
        <Pre>{`// src/content.json
{
  "home": {
    "hero": { "title": "…", "subtitle": "…", "image": "/hero.jpg" }
  }
}`}</Pre>
        <Pre>{`import content from "@/content.json";
<h1 data-cms-field="home.hero.title">{content.home.hero.title}</h1>`}</Pre>
        <p>
          Mark every editable element with <Code>data-cms-field</Code> set to its key path. Use{" "}
          <Code>&lt;img&gt;</Code> for images; for a CSS background put <Code>data-cms-image</Code>{" "}
          on the element as well.
        </p>
        <Note>
          Keep links, colours and layout in code. The CMS should be able to reword a button, not
          repoint it or break the navigation.
        </Note>
      </Step>

      <Step n={2} title="Ship the bridge script">
        <p>
          Copy <Code>cms-bridge.js</Code> into the site's <Code>public/</Code> folder and reference
          it once, at the end of <Code>index.html</Code>:
        </p>
        <Pre>{`<script src="/cms-bridge.js"></script>`}</Pre>
        <p>
          It does nothing on a normal visit. Inside the editor it powers hover highlighting,
          click-to-edit and live preview.
        </p>
        <Note tone="warn">
          A single-page site also needs a catch-all rewrite, or every URL except{" "}
          <Code>/</Code> returns 404 on refresh and on shared links — clicking through the nav
          hides this, because that routing happens in the browser.
          <Pre className="mt-2">{`// vercel.json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`}</Pre>
        </Note>
      </Step>

      <Step n={3} title="Give the CMS access to the repo">
        <p>
          Publishing commits through a fine-grained GitHub token. Add each new client repo to it,
          otherwise the site reads and publishes as "not found".
        </p>
        <p className="text-sm">
          <a
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            href="https://github.com/settings/personal-access-tokens"
            target="_blank"
            rel="noreferrer"
          >
            GitHub → Personal access tokens
            <ExternalLink className="h-3 w-3" />
          </a>{" "}
          → edit the <Code>mirantic-cms</Code> token → add the repository → keep{" "}
          <strong>Contents: Read and write</strong> as the only permission.
        </p>
        <Note>
          Rotating or letting the token expire breaks publishing for every site at once. It is the
          single credential the whole system depends on.
        </Note>
      </Step>

      <Step n={4} title="Add it here">
        <p>
          <Link to="/admin/sites" className="font-medium text-primary hover:underline">
            Sites → Add site
          </Link>
          . A repository URL pasted into the repo field is converted to <Code>owner/repo</Code>{" "}
          automatically.
        </p>
        <dl className="mt-3 divide-y rounded-md border text-sm">
          <Field name="URL" desc="The live site, loaded in the editor's preview pane." />
          <Field name="GitHub repo" desc="Where content.json lives — often not the same repo as the CMS." />
          <Field name="Branch" desc="Usually main. Publishing commits straight to it." />
          <Field
            name="Content path"
            desc="The path inside the repo. Check it: a Vite project whose root is client/ needs client/src/content.json, not the src/content.json default."
          />
          <Field
            name="Deploy hook"
            desc="Optional. Leave empty when the repo is connected to Vercel — the commit already triggers a build. A hook from the wrong project redeploys the wrong site."
          />
          <Field
            name="Has a blog"
            desc="Only if the site renders a blog.posts[] array with a data-cms-posts container and a hidden data-cms-template node."
          />
        </dl>
      </Step>

      <Step n={5} title="Give people access, then test a publish" last>
        <p>
          On the site's row choose <strong>Users</strong> and switch on whoever should work on it —
          a site can have any number, each with their own edit and publish permissions.
        </p>
        <p>
          Then make one small edit and publish it yourself before handing it over. That is the only
          step that writes to a client's repository, so it is worth watching once: the commit
          appears in the repo, the host rebuilds, the change goes live.
        </p>
      </Step>

      <h2 className="mb-3 mt-10 text-base font-semibold">When something doesn't work</h2>
      <Card className="divide-y">
        <Trouble
          symptom="Clicking the page does nothing"
          cause="The page has no data-cms-field attributes yet, or Edit mode is switched off in the sidebar. Only wired pages are editable — the rest still display normally."
        />
        <Trouble
          symptom={'"Waiting for the site" never clears'}
          cause="cms-bridge.js isn't loading. Open the site directly and check /cms-bridge.js returns JavaScript rather than your index.html."
        />
        <Trouble
          symptom="Existing blog posts aren't listed"
          cause="content.json couldn't be read: the repo is missing from the token, or the content path is wrong. The blog section names the underlying error."
        />
        <Trouble
          symptom="Published, but the site looks unchanged"
          cause="The commit landed but the host didn't rebuild. Check the repo's latest commit, then the host's deployments."
        />
      </Card>

      <div className="mt-8 flex gap-2">
        <Button asChild>
          <Link to="/admin/sites">Go to Sites</Link>
        </Button>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
  last,
}: {
  n: number;
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className="relative pb-8 pl-10">
      {!last && <div className="absolute left-[15px] top-8 h-full w-px bg-border" />}
      <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </div>
      <h2 className="pt-1 text-base font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em] text-foreground">
      {children}
    </code>
  );
}

function Pre({ children, className = "" }: { children: string; className?: string }) {
  return (
    <pre
      className={`overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground ${className}`}
    >
      {children}
    </pre>
  );
}

function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      className={
        "rounded-md border-l-2 py-2 pl-3 " +
        (tone === "warn" ? "border-l-destructive bg-destructive/5" : "border-l-primary bg-muted/40")
      }
    >
      {tone === "warn" && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Easy to miss
        </p>
      )}
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Field({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 p-3">
      <dt className="font-medium">{name}</dt>
      <dd className="text-muted-foreground">{desc}</dd>
    </div>
  );
}

function Trouble({ symptom, cause }: { symptom: string; cause: string }) {
  return (
    <div className="p-4">
      <p className="text-sm font-medium">{symptom}</p>
      <p className="mt-1 text-sm text-muted-foreground">{cause}</p>
    </div>
  );
}
