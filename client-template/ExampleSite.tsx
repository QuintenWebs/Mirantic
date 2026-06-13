/**
 * Example of how a client site consumes content.json and marks editable
 * elements with data-cms-field. This is illustrative — adapt to each site's
 * design. The only hard requirements for CMS compatibility are:
 *
 *   1. Import values from content.json.
 *   2. Put data-cms-field="<path>" on every editable element, where <path>
 *      matches the key path in content.json (e.g. "hero.title").
 *   3. Images: the element is an <img> (or has data-cms-image) and its
 *      src/background comes from content.json.
 *   4. Blog: render blog.posts[] with indexed paths, and include ONE hidden
 *      template node so the CMS can preview brand-new posts.
 *   5. Include <script src="/cms-bridge.js"> once (see index.html).
 */
import content from "./content.json";

interface BlogPost {
  title: string;
  slug: string;
  date: string;
  author: string;
  cover: string;
  body: string;
}

export default function ExampleSite() {
  const posts = content.blog?.posts ?? [];

  return (
    <main>
      {/* ── Hero ── */}
      <section>
        <img data-cms-field="hero.image" src={content.hero.image} alt="" />
        <h1 data-cms-field="hero.title">{content.hero.title}</h1>
        <p data-cms-field="hero.subtitle">{content.hero.subtitle}</p>
      </section>

      {/* ── About ── */}
      <section>
        <h2 data-cms-field="about.heading">{content.about.heading}</h2>
        <p data-cms-field="about.body">{content.about.body}</p>
      </section>

      {/* ── Contact ── */}
      <footer>
        <a data-cms-field="contact.email" href={`mailto:${content.contact.email}`}>
          {content.contact.email}
        </a>
        <span data-cms-field="contact.phone">{content.contact.phone}</span>
      </footer>

      {/* ── Blog list ── */}
      <section data-cms-posts>
        {posts.map((post: BlogPost, i: number) => (
          <article key={post.slug}>
            <img data-cms-field={`blog.posts[${i}].cover`} src={post.cover} alt="" />
            <h3 data-cms-field={`blog.posts[${i}].title`}>{post.title}</h3>
            <span data-cms-field={`blog.posts[${i}].date`}>{post.date}</span>
            <span data-cms-field={`blog.posts[${i}].author`}>{post.author}</span>
            <div data-cms-field={`blog.posts[${i}].body`}>{post.body}</div>
          </article>
        ))}
      </section>

      {/*
        Hidden template node — the CMS clones this to preview a NEW post that
        doesn't exist in content.json yet. Field keys here are RELATIVE
        (title, cover, …), not indexed. Keep it visually identical to a real
        post so the preview matches.
      */}
      <article data-cms-template="blog-post" hidden>
        <img data-cms-field="cover" alt="" />
        <h3 data-cms-field="title" />
        <span data-cms-field="date" />
        <span data-cms-field="author" />
        <div data-cms-field="body" />
      </article>
    </main>
  );
}
