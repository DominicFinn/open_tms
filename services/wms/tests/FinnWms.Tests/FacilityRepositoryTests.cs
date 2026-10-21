using Dapper;
using FinnWms.Platform.Data;
using FinnWms.Wms.Facilities;
using Npgsql;

namespace FinnWms.Tests;

public sealed class FacilityRepositoryTests(DatabaseFixture db)
{
    private readonly FacilityRepository _repository = new();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task List_returns_only_the_callers_facilities()
    {
        var mine = DatabaseFixture.NewOrgId();
        var theirs = DatabaseFixture.NewOrgId();
        await db.InsertFacilityAsync(mine, "Leeds");
        await db.InsertFacilityAsync(theirs, "Bristol");

        await using var session = await TenantSession.OpenAsync(db.DataSource, mine, Ct);
        var page = await _repository.ListAsync(session, mine, includeArchived: false, page: 1, perPage: 50, Ct);

        Assert.Equal(["Leeds"], page.Rows.Select(r => r.Name));
        Assert.Equal(1, page.Total);
    }

    [Fact]
    public async Task List_cannot_be_widened_by_passing_another_orgs_id()
    {
        var mine = DatabaseFixture.NewOrgId();
        var theirs = DatabaseFixture.NewOrgId();
        await db.InsertFacilityAsync(theirs, "Bristol");

        // The session is scoped to mine; asking for theirs must still return nothing.
        await using var session = await TenantSession.OpenAsync(db.DataSource, mine, Ct);
        var page = await _repository.ListAsync(session, theirs, includeArchived: false, page: 1, perPage: 50, Ct);

        Assert.Empty(page.Rows);
        Assert.Equal(0, page.Total);
    }

    [Fact]
    public async Task List_hides_archived_unless_asked_and_orders_active_first_then_by_name()
    {
        var org = DatabaseFixture.NewOrgId();
        await db.InsertFacilityAsync(org, "Carlisle", active: false);
        await db.InsertFacilityAsync(org, "York");
        await db.InsertFacilityAsync(org, "Bath");
        await db.InsertFacilityAsync(org, "Archived", archived: true);

        await using var session = await TenantSession.OpenAsync(db.DataSource, org, Ct);
        var live = await _repository.ListAsync(session, org, includeArchived: false, page: 1, perPage: 50, Ct);
        var all = await _repository.ListAsync(session, org, includeArchived: true, page: 1, perPage: 50, Ct);

        Assert.Equal(["Bath", "York", "Carlisle"], live.Rows.Select(r => r.Name));
        Assert.Equal(4, all.Total);
    }

    [Fact]
    public async Task List_pages_and_counts_the_whole_result()
    {
        var org = DatabaseFixture.NewOrgId();
        foreach (var name in new[] { "A", "B", "C", "D", "E" })
        {
            await db.InsertFacilityAsync(org, name);
        }

        await using var session = await TenantSession.OpenAsync(db.DataSource, org, Ct);
        var page = await _repository.ListAsync(session, org, includeArchived: false, page: 2, perPage: 2, Ct);

        Assert.Equal(["C", "D"], page.Rows.Select(r => r.Name));
        Assert.Equal(5, page.Total);
    }

    [Fact]
    public async Task Find_maps_every_column()
    {
        var org = DatabaseFixture.NewOrgId();
        var id = await db.InsertFacilityAsync(org, "Leeds", city: "Leeds");

        await using var session = await TenantSession.OpenAsync(db.DataSource, org, Ct);
        var row = await _repository.FindAsync(session, org, id, Ct);

        Assert.NotNull(row);
        Assert.Equal(id, row.Id);
        Assert.Equal("LEED", row.Code);
        Assert.Equal("Leeds", row.City);
        Assert.True(row.Active);
        Assert.False(row.Archived);
    }

    [Fact]
    public async Task Find_misses_another_orgs_facility()
    {
        var mine = DatabaseFixture.NewOrgId();
        var theirs = DatabaseFixture.NewOrgId();
        var id = await db.InsertFacilityAsync(theirs, "Bristol");

        await using var session = await TenantSession.OpenAsync(db.DataSource, mine, Ct);

        Assert.Null(await _repository.FindAsync(session, mine, id, Ct));
        Assert.Null(await _repository.FindAsync(session, theirs, id, Ct));
    }

    [Fact]
    public async Task App_role_sees_nothing_when_no_org_is_set()
    {
        var org = DatabaseFixture.NewOrgId();
        await db.InsertFacilityAsync(org, "Leeds");

        await using var connection = await db.DataSource.OpenConnectionAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        await connection.ExecuteAsync($"SET LOCAL ROLE {TenantSession.AppRole}", transaction: transaction);

        var count = await connection.ExecuteScalarAsync<long>(
            "SELECT count(*) FROM wms.facility", transaction: transaction);

        Assert.Equal(0, count);
    }

    [Fact]
    public async Task App_role_cannot_read_the_prisma_table_directly()
    {
        await using var connection = await db.DataSource.OpenConnectionAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        await connection.ExecuteAsync($"SET LOCAL ROLE {TenantSession.AppRole}", transaction: transaction);

        var error = await Assert.ThrowsAsync<PostgresException>(() =>
            connection.ExecuteScalarAsync<long>("""SELECT count(*) FROM public."Facility" """, transaction: transaction));

        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, error.SqlState);
    }

    [Fact]
    public async Task Session_settings_do_not_leak_to_the_next_user_of_a_pooled_connection()
    {
        var org = DatabaseFixture.NewOrgId();
        await using (var session = await TenantSession.OpenAsync(db.DataSource, org, Ct))
        {
            await session.CommitAsync(Ct);
        }

        await using var connection = await db.DataSource.OpenConnectionAsync(Ct);
        var orgSetting = await connection.ExecuteScalarAsync<string?>("SELECT current_setting('app.org_id', true)");
        var role = await connection.ExecuteScalarAsync<string>("SELECT current_user");

        Assert.True(string.IsNullOrEmpty(orgSetting));
        Assert.NotEqual(TenantSession.AppRole, role);
    }
}
