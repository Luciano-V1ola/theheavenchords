import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Share2, Link2, MessageCircle, Facebook, Twitter, Mail, Send } from "lucide-react";
import { toast } from "sonner";

type Props = {
  url: string;
  title?: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "ghost" | "default" | "secondary";
  label?: string;
};

// Menú "Compartir" reutilizable: WhatsApp, Facebook, X, Telegram, Discord, Gmail y copiar link.
// Discord no expone share URL — abrimos su web y copiamos el enlace al portapapeles
// para que el usuario lo pegue en el canal/DM.
export default function ShareMenu({ url, title, size = "sm", variant = "outline", label = "Compartir" }: Props) {
  const text = title ? `${title} — The Heaven Chords` : "The Heaven Chords";

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const items = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      action: () => open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`),
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: Facebook,
      action: () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`),
    },
    {
      key: "x",
      label: "X (Twitter)",
      icon: Twitter,
      action: () =>
        open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`),
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: Send,
      action: () =>
        open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`),
    },
    {
      key: "discord",
      label: "Discord",
      icon: MessageCircle,
      action: async () => {
        await copy();
        toast.info("Pegá el enlace en tu canal o DM de Discord");
        open("https://discord.com/channels/@me");
      },
    },
    {
      key: "gmail",
      label: "Gmail",
      icon: Mail,
      action: () =>
        open(
          `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`
        ),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size as any} variant={variant}>
          <Share2 className="w-4 h-4 mr-1" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((i) => (
          <DropdownMenuItem key={i.key} onClick={i.action} className="cursor-pointer">
            <i.icon className="w-4 h-4 mr-2" /> {i.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copy} className="cursor-pointer">
          <Link2 className="w-4 h-4 mr-2" /> Copiar enlace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
