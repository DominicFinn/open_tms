using Dapper;
using FinnWms.Platform.Data;

namespace FinnWms.Wms.Facilities;

public sealed class FacilityRow
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? Code { get; init; }
    public string? SourceLocationId { get; init; }
    public string? Address1 { get; init; }
    public string? Address2 { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? PostalCode { get; init; }
    public string? Country { get; init; }
    public string? Timezone { get; init; }
    public bool Active { get; init; }
    public bool Archived { get; init; }
}

public sealed record FacilityPage(IReadOnlyList<FacilityRow> Rows, long Total);

/// <summary>
/// Facilities, read through the transitional <c>wms.facility</c> view until the table moves into
/// the <c>wms</c> schema. The view already filters to <c>app.org_id</c>; the explicit
/// <c>org_id</c> predicate keeps the intent visible and survives the move to a real table.
/// </summary>
public sealed class FacilityRepository
{
    private const string Columns = """
        id, name, code, source_location_id, address1, address2, city, state, postal_code, country,
        timezone, active, archived
        """;

    public async Task<FacilityPage> ListAsync(
        TenantSession session, string orgId, bool includeArchived, int page, int perPage,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(session);

        var sql = $"""
            SELECT {Columns}
            FROM wms.facility
            WHERE org_id = @OrgId AND (@IncludeArchived OR NOT archived)
            ORDER BY active DESC, name ASC
            LIMIT @Limit OFFSET @Offset;

            SELECT count(*)
            FROM wms.facility
            WHERE org_id = @OrgId AND (@IncludeArchived OR NOT archived);
            """;

        using var results = await session.Connection.QueryMultipleAsync(new CommandDefinition(
            sql,
            new { OrgId = orgId, IncludeArchived = includeArchived, Limit = perPage, Offset = (page - 1) * perPage },
            session.Transaction,
            cancellationToken: cancellationToken));

        var rows = (await results.ReadAsync<FacilityRow>()).AsList();
        var total = await results.ReadSingleAsync<long>();
        return new FacilityPage(rows, total);
    }

    public Task<FacilityRow?> FindAsync(
        TenantSession session, string orgId, string id, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(session);

        return session.Connection.QuerySingleOrDefaultAsync<FacilityRow>(new CommandDefinition(
            $"SELECT {Columns} FROM wms.facility WHERE org_id = @OrgId AND id = @Id",
            new { OrgId = orgId, Id = id },
            session.Transaction,
            cancellationToken: cancellationToken));
    }
}
