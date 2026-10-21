namespace FinnWms.Platform.Auth;

/// <summary>An authenticated principal with no organisation. Tenant-scoped work must refuse it.</summary>
public sealed class MissingTenantException()
    : Exception("Multi-tenancy: this route requires an authenticated tenant context");
