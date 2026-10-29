import type { MouseEvent, ReactNode } from "react";
import { songPath } from "@/lib/slug";

export function isPlainLeftClick(event: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented">) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function SongTitleLink({ slug, title, onOpen, children }: { slug?: string | null; title: string; onOpen: () => void; children?: ReactNode }) {
  return (
    <a href={songPath(slug, title)} onClick={event => {
      event.stopPropagation();
      if (!isPlainLeftClick(event)) return;
      event.preventDefault();
      onOpen();
    }}>{children ?? title}</a>
  );
}