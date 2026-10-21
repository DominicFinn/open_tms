using Dapper;
using FinnWms.Platform.Events;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace FinnWms.Platform.Data;

public static class DataServiceCollectionExtensions
{
    public static IServiceCollection AddWmsData(this IServiceCollection services, string connectionString)
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        // Named so metrics label the pool "finnwms" rather than with the host, database and user.
        services.AddSingleton(_ => new NpgsqlDataSourceBuilder(connectionString) { Name = "finnwms" }.Build());
        services.AddScoped<TenantDb>();
        services.AddSingleton<Outbox>();
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
        return services;
    }
}
