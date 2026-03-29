/**
 * File Storage Provider Interface
 *
 * Abstracts file storage so EDI files (and other files) can be stored
 * in different backends: database, filesystem, S3, GCS, etc.
 *
 * Default implementation: DatabaseFileStorage (stores in EdiFile.fileContent column)
 *
 * To add a new provider, implement this interface and register it in the DI container.
 */
export interface IFileStorageProvider {
  /** Store file content. Returns a storage key for later retrieval. */
  store(fileId: string, content: string, metadata?: Record<string, string>): Promise<string>;

  /** Retrieve file content by storage key. */
  retrieve(storageKey: string): Promise<string>;

  /** Delete file content by storage key. */
  delete(storageKey: string): Promise<void>;

  /** Check if a file exists by storage key. */
  exists(storageKey: string): Promise<boolean>;
}
