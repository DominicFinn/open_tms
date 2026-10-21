/**
 * Finds the open issue raised against a source entity (#359). Core implements it over the issue
 * engine; WMS uses it to link a pack audit to the issue its variance raised.
 */
export interface IOpenIssueLookup {
  findOpenIssueId(orgId: string, issueType: string, sourceEntityType: string, sourceEntityId: string): Promise<string | null>;
}
