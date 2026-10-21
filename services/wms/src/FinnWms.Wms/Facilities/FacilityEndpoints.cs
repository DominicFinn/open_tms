using FinnWms.Platform.Auth;
using FinnWms.Platform.Data;
using FinnWms.Platform.Http;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace FinnWms.Wms.Facilities;

public static class FacilityEndpoints
{
    public const int DefaultPerPage = 50;
    public const int MaxPerPage = 100;

    public static IEndpointRouteBuilder MapFacilityEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/facilities")
            .WithTags("WMS - Facilities")
            .RequireAuthorization(Policies.WmsRead);

        group.MapGet("/", ListAsync)
            .WithName("ListFacilities")
            .WithSummary("List facilities for the current organisation")
            .Produces<PagedEnvelope<FacilityDto>>()
            .Produces<ErrorEnvelope>(StatusCodes.Status400BadRequest);

        group.MapGet("/{id}", GetAsync)
            .WithName("GetFacility")
            .WithSummary("Get a facility")
            .Produces<Envelope<FacilityDto>>()
            .Produces<ErrorEnvelope>(StatusCodes.Status400BadRequest)
            .Produces<ErrorEnvelope>(StatusCodes.Status404NotFound);

        return routes;
    }

    private static async Task<IResult> ListAsync(
        TenantDb db, FacilityRepository repository, CancellationToken cancellationToken,
        int page = 1, int perPage = DefaultPerPage, bool includeArchived = false)
    {
        if (page < 1 || perPage < 1 || perPage > MaxPerPage)
        {
            return ApiErrors.Result(StatusCodes.Status400BadRequest, $"page must be at least 1 and perPage between 1 and {MaxPerPage}");
        }

        var session = await db.SessionAsync(cancellationToken);
        var result = await repository.ListAsync(session, session.OrgId, includeArchived, page, perPage, cancellationToken);
        return Results.Ok(new PagedEnvelope<FacilityDto>(
            result.Rows.Select(FacilityDto.From).ToList(), new PageMeta(page, perPage, result.Total), null));
    }

    private static async Task<IResult> GetAsync(
        string id, TenantDb db, FacilityRepository repository, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(id, out _))
        {
            return ApiErrors.Result(StatusCodes.Status400BadRequest, "id must be a UUID");
        }

        var session = await db.SessionAsync(cancellationToken);
        var facility = await repository.FindAsync(session, session.OrgId, id, cancellationToken);

        // A cross-tenant id misses rather than 403s, so existence stays opaque.
        return facility is null
            ? ApiErrors.Result(StatusCodes.Status404NotFound, "Facility not found")
            : Results.Ok(new Envelope<FacilityDto>(FacilityDto.From(facility), null));
    }
}
