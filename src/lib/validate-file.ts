// Section 1: File upload security — magic byte validation + size enforcement.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const MAGIC_BYTES: Record<string, number[][]> = {
  ".pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  ".docx": [[0x50, 0x4b, 0x03, 0x04]], // PK (ZIP — DOCX is a ZIP container)
};

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

export async function validateFile(file: File): Promise<void> {
  if (file.size === 0) throw new Error("File is empty.");
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large. Maximum is ${MAX_BYTES / 1_048_576} MB.`);
  }

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT.");
  }

  const sigs = MAGIC_BYTES[ext];
  if (!sigs) return; // TXT: no magic bytes to check

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid = sigs.some((sig) => sig.every((byte, i) => header[i] === byte));
  if (!valid) {
    throw new Error(
      `File content doesn't match its extension. Upload a real ${ext.toUpperCase()} file.`,
    );
  }
}

// Returns a UUID filename — never expose the original filename to storage paths.
export function safeStorageName(ext: string): string {
  return `${crypto.randomUUID()}${ext}`;
}
