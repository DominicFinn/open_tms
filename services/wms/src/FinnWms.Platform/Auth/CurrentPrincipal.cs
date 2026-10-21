using Microsoft.AspNetCore.Http;

namespace FinnWms.Platform.Auth;

/// <summary>The caller, read from the validated token on the current request.</summary>
public sealed class CurrentPrincipal(IHttpContextAccessor accessor)
{
    public string OrgId =>
        accessor.HttpContext?.User.FindFirst(InternalClaims.OrganizationId)?.Value is { Length: > 0 } orgId
            ? orgId
            : throw new MissingTenantException();

    public string? UserId => accessor.HttpContext?.User.FindFirst(InternalClaims.Subject)?.Value;
}
