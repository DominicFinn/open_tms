using Microsoft.AspNetCore.Authorization;

namespace FinnWms.Platform.Auth;

/// <summary>
/// Requires a permission, and refuses scoped sessions unless the endpoint names their scope.
/// </summary>
/// <remarks>
/// BUSINESS RULE: a warehouse or inventory session is minted by a magic link that can hang on a
/// printed QR code, so it only reaches the endpoints that list its scope. Everything else needs an
/// unrestricted session.
/// </remarks>
public sealed class PermissionRequirement(string permission, params string[] allowedSessionScopes)
    : IAuthorizationRequirement
{
    public string Permission { get; } = permission;

    public IReadOnlyCollection<string> AllowedSessionScopes { get; } = allowedSessionScopes;
}

public sealed class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var user = context.User;
        var scope = user.FindFirst(InternalClaims.SessionScope)?.Value;
        if (scope is not null && !requirement.AllowedSessionScopes.Contains(scope))
        {
            return Task.CompletedTask;
        }

        var granted = user.FindAll(InternalClaims.Permissions).Select(c => c.Value).ToHashSet();
        if (Grants(granted, requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }

    /// <summary><c>*</c> grants everything, <c>wms:*</c> grants every <c>wms:</c> permission.</summary>
    private static bool Grants(HashSet<string> granted, string required)
    {
        if (granted.Contains("*") || granted.Contains(required))
        {
            return true;
        }

        var resource = required.Split(':')[0];
        return granted.Contains($"{resource}:*");
    }
}
