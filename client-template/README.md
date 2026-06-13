# Wiring a client site for the Mirantic CMS

Every site you build that should be editable in the CMS needs three things.
This takes ~10 minutes per site.

## 1. A `content.json` file

All editable content lives in one JSON file in the repo (default path
`src/content.json`). Components import it and render values from it. See
[`content.json`](./content.json) for the shape.

```ts
import content from "./content.json";
// ...
<h1>{content.hero.title}</h1>
```

## 2. `data-cms-field` attributes

Put `data-cms-field="<path>"` on every element a client may edit. The path is
the key path in `content.json`:

```tsx
<h1 data-cms-field="hero.title">{content.hero.title}</h1>
<img data-cms-field="hero.image" src={content.hero.image} alt="" />
```

- **Text** elements: the CMS edits their text content.
- **Images**: use an `<img>` (the CMS sets `src`). For a CSS background image,
  put `data-cms-image` on the element instead — the CMS sets `background-image`.

See [`ExampleSite.tsx`](./ExampleSite.tsx) for a full example.

### Blog (only if the site has a blog)

Render posts from `content.blog.posts[]` with **indexed** paths, wrap the list
in a container marked `data-cms-posts`, and include **one hidden template node**
marked `data-cms-template="blog-post"` with **relative** field keys. The CMS
clones this template to preview brand-new posts before they're published.

```tsx
<section data-cms-posts>
  {posts.map((post, i) => (
    <article key={post.slug}>
      <h3 data-cms-field={`blog.posts[${i}].title`}>{post.title}</h3>
      {/* … */}
    </article>
  ))}
</section>

{/* hidden — used by the CMS to preview new posts */}
<article data-cms-template="blog-post" hidden>
  <h3 data-cms-field="title" />
  {/* … relative keys, no index … */}
</article>
```

## 3. The bridge script

Copy [`cms-bridge.js`](./cms-bridge.js) into the site's `public/` folder and
reference it once in `index.html`:

```html
<script src="/cms-bridge.js"></script>
```

It does nothing on normal visits. When the site is opened inside the CMS
editor it enables hover-highlight, click-to-edit, and live preview. No build
config, no dependencies.

## 4. Register the site in the CMS

In the CMS admin → **Sites → Add site**, fill in:

- **URL** — the live site URL (what the editor loads in the iframe)
- **GitHub repo** — `owner/repo`
- **Branch** — usually `main`
- **Content path** — e.g. `src/content.json`
- **Deploy hook URL** — (optional) a Vercel deploy hook for the project
- **Has blog** — toggle on if the site has a blog

Then assign a client to the site. Publishing commits `content.json` to the repo
(triggering Vercel's auto-deploy) and also pings the deploy hook if set.

---

**The CMS only ever reads and writes `content.json`.** It never touches
components, styles, config, or anything else in the repo.
