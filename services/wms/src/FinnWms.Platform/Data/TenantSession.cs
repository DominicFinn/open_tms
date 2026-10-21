using Dapper;
using Npgsql;

namespace FinnWms.Platform.Data;

/// <summary>
/// One tenant-scoped database transaction. Every query the service runs goes through one.
/// </summary>
/// <remarks>
/// Opening a session sets <c>app.org_id</c> and switches to the <c>wms_app</c> role for the life of
/// the transaction (both <c>LOCAL</c>), so row-level security and the tenant filter on the
/// transitional views apply whichever login role the service connected as. A pooled connection
/// carries neither setting past the end of the transaction.
/// Disposing without <see cref="CommitAsync"/> rolls back.
/// </remarks>
public sealed class TenantSession : IAsyncDisposable
{
    public const string AppRole = "wms_app";

    private bool _committed;

    private TenantSession(string orgId, NpgsqlConnection connection, NpgsqlTransaction transaction)
    {
        OrgId = orgId;
        Connection = connection;
        Transaction = transaction;
    }

    public string OrgId { get; }

    public NpgsqlConnection Connection { get; }

    public NpgsqlTransaction Transaction { get; }

    public static async Task<TenantSession> OpenAsync(
        NpgsqlDataSource dataSource, string orgId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(dataSource);
        ArgumentException.ThrowIfNullOrWhiteSpace(orgId);

        var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        try
        {
            var transaction = await connection.BeginTransactionAsync(cancellationToken);
            await connection.ExecuteAsync(new CommandDefinition(
                $"SELECT set_config('app.org_id', @OrgId, true); SET LOCAL ROLE {AppRole};",
                new { OrgId = orgId },
                transaction,
                cancellationToken: cancellationToken));
            return new TenantSession(orgId, connection, transaction);
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }

    public async Task CommitAsync(CancellationToken cancellationToken)
    {
        await Transaction.CommitAsync(cancellationToken);
        _committed = true;
    }

    public async ValueTask DisposeAsync()
    {
        if (!_committed)
        {
            await Transaction.RollbackAsync();
        }

        await Transaction.DisposeAsync();
        await Connection.DisposeAsync();
    }
}
