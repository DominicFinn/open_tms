using Dapper;
using FinnWms.Platform.Data;
using FinnWms.Platform.Events;
using Npgsql;

namespace FinnWms.Tests;

public sealed class OutboxTests(DatabaseFixture db)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <summary>
    /// The read the Node relay runs (backend/src/events/bridge/WmsOutboxReader.ts). Kept here so the
    /// guarantee it depends on is tested against real Postgres.
    /// </summary>
    private const string RelayRead = """
        SELECT id FROM wms.outbox
        WHERE (tx_id, position) > (@TxId::xid8, @Position)
          AND tx_id < pg_snapshot_xmin(pg_current_snapshot())
        ORDER BY tx_id, position
        """;

    private static OutboxEvent Event(string entityId) =>
        new("handling_unit.moved", "handling_unit", entityId, new { binId = "bin-1" }, 1, "user-1", "corr-1");

    private async Task<List<string>> RelaySeesAsync(string orgFilterEntityPrefix)
    {
        await using var connection = await db.DataSource.OpenConnectionAsync(Ct);
        var ids = await connection.QueryAsync<string>(RelayRead + "", new { TxId = "0", Position = 0L });
        var entities = await connection.QueryAsync<string>(
            "SELECT entity_id FROM wms.outbox WHERE id = ANY(@Ids) ORDER BY tx_id, position",
            new { Ids = ids.ToArray() });
        return entities.Where(e => e.StartsWith(orgFilterEntityPrefix, StringComparison.Ordinal)).ToList();
    }

    [Fact]
    public async Task An_event_commits_with_its_session_carrying_the_session_org_and_node_metadata()
    {
        var org = DatabaseFixture.NewOrgId();
        var outbox = new Outbox();
        await using (var session = await TenantSession.OpenAsync(db.DataSource, org, Ct))
        {
            await outbox.EnqueueAsync(session, Event($"{org}-a"), Ct);
            await session.CommitAsync(Ct);
        }

        await using var connection = await db.DataSource.OpenConnectionAsync(Ct);
        var row = await connection.QuerySingleAsync<(string OrgId, string Type, string Metadata, string Payload)>(
            "SELECT org_id, type, metadata::text, payload::text FROM wms.outbox WHERE entity_id = @E", new { E = $"{org}-a" });

        Assert.Equal(org, row.OrgId);
        Assert.Equal("handling_unit.moved", row.Type);
        Assert.Contains("\"correlationId\": \"corr-1\"", row.Metadata, StringComparison.Ordinal);
        Assert.Contains("\"source\": \"finnwms\"", row.Metadata, StringComparison.Ordinal);
        Assert.Contains("\"schemaVersion\": 1", row.Metadata, StringComparison.Ordinal);
        Assert.Contains("\"binId\": \"bin-1\"", row.Payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task An_event_rolls_back_with_its_session()
    {
        var org = DatabaseFixture.NewOrgId();
        await using (var session = await TenantSession.OpenAsync(db.DataSource, org, Ct))
        {
            await new Outbox().EnqueueAsync(session, Event($"{org}-rolled-back"), Ct);
        }

        await using var connection = await db.DataSource.OpenConnectionAsync(Ct);
        Assert.Equal(0, await connection.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM wms.outbox WHERE entity_id = @E", new { E = $"{org}-rolled-back" }));
    }

    [Fact]
    public async Task The_app_role_cannot_write_an_event_for_another_org()
    {
        var org = DatabaseFixture.NewOrgId();
        await using var session = await TenantSession.OpenAsync(db.DataSource, org, Ct);

        var write = await Assert.ThrowsAsync<PostgresException>(() => session.Connection.ExecuteAsync(
            """
            INSERT INTO wms.outbox (id, type, org_id, entity_type, entity_id, payload, metadata)
            VALUES ('x', 't', 'some-other-org', 'e', 'e', '{}', '{}')
            """, transaction: session.Transaction));
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, write.SqlState);
    }

    [Fact]
    public async Task A_row_from_an_open_transaction_holds_back_later_rows_until_it_commits()
    {
        var org = DatabaseFixture.NewOrgId();
        var outbox = new Outbox();

        // A writes first and stays open; B writes after and commits.
        await using var a = await TenantSession.OpenAsync(db.DataSource, org, Ct);
        await outbox.EnqueueAsync(a, Event($"{org}-first"), Ct);

        await using (var b = await TenantSession.OpenAsync(db.DataSource, org, Ct))
        {
            await outbox.EnqueueAsync(b, Event($"{org}-second"), Ct);
            await b.CommitAsync(Ct);
        }

        // B has committed, but reading it now would let a cursor pass A's row before A is visible.
        Assert.Empty(await RelaySeesAsync(org));

        await a.CommitAsync(Ct);

        // Other tests run in parallel and may briefly hold a transaction open, which holds the
        // relay back too, so wait for the rows rather than expecting them at once.
        var seen = await RelaySeesAsync(org);
        for (var attempt = 0; seen.Count < 2 && attempt < 50; attempt++)
        {
            await Task.Delay(100, Ct);
            seen = await RelaySeesAsync(org);
        }

        Assert.Equal([$"{org}-first", $"{org}-second"], seen);
    }
}
