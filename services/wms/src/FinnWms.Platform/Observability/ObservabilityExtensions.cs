using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace FinnWms.Platform.Observability;

public static class ObservabilityExtensions
{
    public const string ServiceName = "finnwms";

    /// <summary>
    /// Traces for HTTP and Npgsql, metrics for HTTP, the runtime and the connection pool. Metrics
    /// are scraped from <c>/metrics</c>; traces and metrics also go to an OTLP collector when
    /// <c>OTEL_EXPORTER_OTLP_ENDPOINT</c> is set.
    /// </summary>
    public static IServiceCollection AddWmsObservability(this IServiceCollection services, IConfiguration configuration)
    {
        var otlp = !string.IsNullOrEmpty(configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]);

        services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService(ServiceName))
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation(o => o.Filter = context => !IsOperational(context.Request.Path))
                    .AddNpgsql();
                if (otlp)
                {
                    tracing.AddOtlpExporter();
                }
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddMeter("Npgsql")
                    .AddPrometheusExporter();
                if (otlp)
                {
                    metrics.AddOtlpExporter();
                }
            });

        return services;
    }

    /// <summary>
    /// <c>/metrics</c> carries no tenant data, only process and request counters, so it is not
    /// behind auth. Keep it off the public network at the proxy.
    /// </summary>
    public static WebApplication MapOperationalEndpoints(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.MapPrometheusScrapingEndpoint("/metrics");
        app.MapHealthChecks("/health");
        return app;
    }

    private static bool IsOperational(PathString path) =>
        path.StartsWithSegments("/metrics") || path.StartsWithSegments("/health");
}
