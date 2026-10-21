using System.Text;
using FinnWms.Platform.Http;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace FinnWms.Platform.Auth;

public static partial class AuthServiceCollectionExtensions
{
    /// <summary>Matches the Node backend's development fallback, so local tokens work on both.</summary>
    public const string DevelopmentSecret = "open-tms-dev-secret-change-in-production";

    /// <summary>
    /// Validates the internal tokens core auth issues: HS256 over the shared <c>JWT_SECRET</c>,
    /// issuer <c>open-tms-auth</c>, an expiry, and an organisation.
    /// </summary>
    public static IServiceCollection AddInternalJwtAuth(
        this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var key = SigningKey(configuration["JWT_SECRET"], environment);

        services.AddHttpContextAccessor();
        services.AddScoped<CurrentPrincipal>();
        services.AddSingleton<IAuthorizationHandler, PermissionHandler>();

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = InternalClaims.Issuer,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    RequireExpirationTime = true,
                    ClockSkew = TimeSpan.Zero,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    NameClaimType = InternalClaims.Subject,
                };
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = RequireTenant,
                    OnAuthenticationFailed = LogRejected,
                    OnChallenge = WriteUnauthorised,
                    OnForbidden = WriteForbidden,
                };
            });

        services
            .AddAuthorizationBuilder()
            .AddPolicy(Policies.WmsRead, p => p.RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement("wms:read")))
            .AddPolicy(Policies.WmsReadForInventoryApp, p => p.RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement("wms:read", "inventory")))
            .AddPolicy(Policies.WmsWrite, p => p.RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement("wms:write")));

        return services;
    }

    private static SymmetricSecurityKey SigningKey(string? secret, IHostEnvironment environment)
    {
        if (string.IsNullOrEmpty(secret))
        {
            if (environment.IsProduction())
            {
                throw new InvalidOperationException("JWT_SECRET environment variable is required in production");
            }

            secret = DevelopmentSecret;
        }

        var bytes = Encoding.UTF8.GetBytes(secret);
        if (bytes.Length < 32)
        {
            throw new InvalidOperationException("JWT_SECRET must be at least 32 bytes, since HS256 needs a 256-bit key");
        }

        return new SymmetricSecurityKey(bytes);
    }

    private static Task RequireTenant(TokenValidatedContext context)
    {
        // A token with no organisation can never select a tenant, so it fails authentication
        // outright rather than reaching an endpoint that would have to guess one.
        if (string.IsNullOrEmpty(context.Principal?.FindFirst(InternalClaims.OrganizationId)?.Value))
        {
            context.Fail(new MissingTenantException());
        }

        return Task.CompletedTask;
    }

    private static Task LogRejected(AuthenticationFailedContext context)
    {
        var logger = context.HttpContext.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("FinnWms.Auth");
        LogTokenRejected(logger, context.Exception.GetType().Name, context.HttpContext.Connection.RemoteIpAddress?.ToString());
        return Task.CompletedTask;
    }

    private static async Task WriteUnauthorised(JwtBearerChallengeContext context)
    {
        context.HandleResponse();
        var message = context.AuthenticateFailure switch
        {
            MissingTenantException tenant => tenant.Message,
            not null => "Invalid or expired token",
            null => "Authorization header required",
        };
        await ApiErrors.WriteAsync(context.Response, StatusCodes.Status401Unauthorized, message);
    }

    private static Task WriteForbidden(ForbiddenContext context) =>
        ApiErrors.WriteAsync(context.Response, StatusCodes.Status403Forbidden, "Insufficient permissions");

    [LoggerMessage(Level = LogLevel.Warning, Message = "Token rejected {Reason} from {Ip}")]
    private static partial void LogTokenRejected(ILogger logger, string reason, string? ip);
}
