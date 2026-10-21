using FinnWms.Platform.Auth;
using Npgsql;

namespace FinnWms.Platform.Data;

/// <summary>
/// The request's tenant session, opened on first use with the caller's organisation.
/// </summary>
/// <remarks>
/// Scoped per request, so a handler cannot pick the tenant: it always comes from the token. A
/// write handler commits the session itself; anything left uncommitted rolls back when the request
/// ends.
/// </remarks>
public sealed class TenantDb(NpgsqlDataSource dataSource, CurrentPrincipal principal) : IAsyncDisposable
{
    private TenantSession? _session;

    public async ValueTask<TenantSession> SessionAsync(CancellationToken cancellationToken) =>
        _session ??= await TenantSession.OpenAsync(dataSource, principal.OrgId, cancellationToken);

    public async ValueTask DisposeAsync()
    {
        if (_session is not null)
        {
            await _session.DisposeAsync();
        }
    }
}
