namespace FinnWms.Wms.Facilities;

public sealed record FacilityAddressDto(
    string? Address1, string? Address2, string? City, string? State, string? PostalCode, string? Country);

/// <summary>Same shape as the Node endpoint it replaces, so the frontend sees no difference.</summary>
public sealed record FacilityDto(
    string Id,
    string Name,
    string? Code,
    string? SourceLocationId,
    FacilityAddressDto Address,
    string? Timezone,
    bool Active,
    bool Archived)
{
    public static FacilityDto From(FacilityRow row)
    {
        ArgumentNullException.ThrowIfNull(row);
        return new FacilityDto(
            row.Id,
            row.Name,
            row.Code,
            row.SourceLocationId,
            new FacilityAddressDto(row.Address1, row.Address2, row.City, row.State, row.PostalCode, row.Country),
            row.Timezone,
            row.Active,
            row.Archived);
    }
}
