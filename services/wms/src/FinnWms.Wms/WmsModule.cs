using FinnWms.Wms.Facilities;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace FinnWms.Wms;

/// <summary>The WMS module's public surface: its services and its endpoints.</summary>
public static class WmsModule
{
    public static IServiceCollection AddWmsModule(this IServiceCollection services)
    {
        services.AddSingleton<FacilityRepository>();
        return services;
    }

    public static IEndpointRouteBuilder MapWmsModule(this IEndpointRouteBuilder routes)
    {
        routes.MapFacilityEndpoints();
        return routes;
    }
}
