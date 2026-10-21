namespace FinnWms.Platform.Auth;

/// <summary>Claim names in the internal <c>open-tms-auth</c> token, as minted by core auth.</summary>
public static class InternalClaims
{
    public const string Issuer = "open-tms-auth";
    public const string Subject = "sub";
    public const string OrganizationId = "organizationId";
    public const string Permissions = "permissions";

    /// <summary>
    /// Surface restriction: <c>warehouse</c> for a PWA session, <c>inventory</c> for the inventory
    /// app. Absent means an unrestricted admin session.
    /// </summary>
    public const string SessionScope = "scope";
}
