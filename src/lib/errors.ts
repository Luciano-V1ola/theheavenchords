// Convierte errores técnicos (Postgres, Supabase, red) en mensajes amigables.
// El error real se registra en la consola para depuración.
export function friendlyError(err: unknown, fallback = "Ocurrió un error. Intentá de nuevo."): string {
  // eslint-disable-next-line no-console
  console.error("[app-error]", err);
  const msg = (err as any)?.message?.toString() ?? "";
  const code = (err as any)?.code?.toString() ?? "";

  // Mapeos conocidos → mensajes en español, sin filtrar detalles internos
  if (/permission denied|not authorized|rls|row-level security/i.test(msg)) {
    return "No tenés permiso para hacer esta acción.";
  }
  if (/duplicate key|already exists|unique constraint/i.test(msg) || code === "23505") {
    return "Ese registro ya existe.";
  }
  if (/foreign key|violates foreign key/i.test(msg) || code === "23503") {
    return "No se puede completar porque hay datos relacionados.";
  }
  if (/not authenticated|jwt|auth/i.test(msg)) {
    return "Iniciá sesión para continuar.";
  }
  if (/network|fetch|failed to fetch/i.test(msg)) {
    return "Problema de conexión. Revisá tu internet.";
  }
  if (/invalid.*email/i.test(msg)) return "El email no es válido.";
  if (/password/i.test(msg) && /weak|short|length/i.test(msg)) {
    return "La contraseña es demasiado débil.";
  }
  return fallback;
}
