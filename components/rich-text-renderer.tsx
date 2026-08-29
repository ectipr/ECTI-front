// Renders Strapi rich-text "blocks" (the array of { type, children } nodes
// produced by the blocks field) into styled React elements.

import { absoluteMediaUrl } from "@/lib/strapi-media";
import { safeUrl } from "@/lib/safe-url";

// Recursive child node renderer
function RenderChild({ child }: { child: any }) {
  if (child.type === "link") {
    const children = child.children?.map((c: any, idx: number) => (
      <RenderChild key={idx} child={c} />
    ));

    // A link whose URL isn't http(s)/mailto/tel keeps its text and loses the
    // anchor. The rejected case in practice is `javascript:`, which React
    // renders happily and which turns an editor account into script running in
    // every reader's browser.
    const href = safeUrl(child.url);
    if (!href) return <>{children}</>;

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-primary/80 transition-colors"
      >
        {children}
      </a>
    );
  }

  const text = child.text ?? "";
  return (
    <span
      className={`${child.bold ? "font-semibold" : ""} ${child.italic ? "italic" : ""} ${child.underline ? "underline" : ""} ${child.strikethrough ? "line-through" : ""}`}
    >
      {text}
    </span>
  );
}

export function RichTextRenderer({ blocks }: { blocks: any[] }) {
  if (!blocks?.length) return null;
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className="mb-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {block.children?.map((child: any, j: number) => (
                  <RenderChild key={j} child={child} />
                ))}
              </p>
            );
          case "heading": {
            const level = block.level ?? 2;
            const headingClass =
              level === 1 ? "mt-8 mb-3 text-2xl font-bold text-foreground" :
              level === 2 ? "mt-7 mb-2 text-xl font-bold text-foreground" :
                            "mt-6 mb-2 text-lg font-semibold text-foreground";
            const Tag = `h${level}` as "h1" | "h2" | "h3";
            return (
              <Tag key={i} className={headingClass}>
                {block.children?.map((child: any, j: number) => (
                  <RenderChild key={j} child={child} />
                ))}
              </Tag>
            );
          }
          case "list":
            return (
              <ul key={i} className="mb-4 flex flex-col gap-1">
                {block.children?.map((item: any, j: number) => (
                  <li key={j} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      {item.children?.map((child: any, idx: number) => (
                        <RenderChild key={idx} child={child} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={i} className="my-4 border-l-4 border-primary pl-4 italic text-muted-foreground whitespace-pre-wrap">
                {block.children?.map((child: any, j: number) => (
                  <RenderChild key={j} child={child} />
                ))}
              </blockquote>
            );
          case "image": {
            const img = block.image;
            if (!img?.url) return null;
            return (
              <figure key={i} className="my-6">
                <img
                  src={absoluteMediaUrl(img.url)}
                  alt={img.alternativeText || ""}
                  loading="lazy"
                  className="mx-auto h-auto max-w-full rounded-lg border border-border"
                />
                {img.caption && (
                  <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                    {img.caption}
                  </figcaption>
                )}
              </figure>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}
