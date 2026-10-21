using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace FinnWms.Platform.Http;

public static class HttpApplicationBuilderExtensions
{
    public const string PerCallerPolicy = "per-caller";

    /// <summary>
    /// A per-caller ceiling on the API: keyed by the token's subject, or by IP before
    /// authentication has run.
    /// </summary>
    public static IServiceCollection AddWmsRateLimiting(this IServiceCollection services, int permitsPerMinute)
    {
        services.AddRateLimiter(options =>
        {
            options.OnRejected = (context, cancellationToken) => new ValueTask(
                ApiErrors.WriteAsync(context.HttpContext.Response, StatusCodes.Status429TooManyRequests, "Too many requests"));
            options.AddPolicy(PerCallerPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = permitsPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));
        });
        return services;
    }

    /// <summary>
    /// The security headers every response carries. The API never serves a page, so the
    /// content security policy forbids everything.
    /// </summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;
            headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";
            headers.XFrameOptions = "DENY";
            headers.XContentTypeOptions = "nosniff";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
            headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
            await next(context);
        });

    /// <summary>
    /// Unhandled exceptions become a 500 envelope with no detail. The exception handler middleware
    /// has already logged the exception with its stack trace.
    /// </summary>
    public static IApplicationBuilder UseEnvelopeExceptionHandler(this IApplicationBuilder app) =>
        app.UseExceptionHandler(errorApp => errorApp.Run(context =>
        {
            var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
            return error is BadHttpRequestException bad
                ? ApiErrors.WriteAsync(context.Response, bad.StatusCode, "Bad request")
                : ApiErrors.WriteAsync(context.Response, StatusCodes.Status500InternalServerError, "Internal server error");
        }));
}
