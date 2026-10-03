/**
 * File Storage Provider Interface
 *
 * Every call names the org, because the database provider's keys are EdiTransactionLog ids and
 * those rows belong to a tenant.
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
  store(orgId: string, fileId: string, content: string, metadata?: Record<string, string>): Promise<string>;

  /** Retrieve file content by storage key. */
  retrieve(orgId: string, storageKey: string): Promise<string>;

  /** Delete file content by storage key. */
  delete(orgId: string, storageKey: string): Promise<void>;

  /** Check if a file exists by storage key. */
  exists(orgId: string, storageKey: string): Promise<boolean>;
}
