/**
 * Binary Storage Provider Interface
 *
 * Abstracts binary file storage (PDFs, images, uploads) so files can be stored
 * in different backends: S3, MinIO, Azure Blob (S3 compat), or database fallback.
 *
 * Separate from IFileStorageProvider (string-based, used for EDI files).
 */
export interface IBinaryStorageProvider {
  /** Store binary content at the given key. Returns the storage key. */
  store(key: string, content: Buffer, metadata?: Record<string, string>): Promise<string>;

  /** Retrieve binary content by storage key. */
  retrieve(key: string): Promise<Buffer>;

  /** Delete binary content by storage key. */
  delete(key: string): Promise<void>;

  /** Check if content exists at the given key. */
  exists(key: string): Promise<boolean>;

  /** Get a pre-signed URL for direct download (optional — not all backends support this). */
  getSignedUrl?(key: string, expiresInSeconds?: number): Promise<string>;
}
