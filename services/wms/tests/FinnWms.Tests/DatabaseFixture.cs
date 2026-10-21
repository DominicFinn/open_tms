using Dapper;
using FinnWms.Platform.Data;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(FinnWms.Tests.DatabaseFixture))]

namespace FinnWms.Tests;

/// <summary>
/// One Postgres for the whole test run. Tests isolate themselves by organisation, using a fresh
/// org id each, so they can share it.
/// </summary>
public sealed class DatabaseFixture : IAsyncLifetime
{
    // Copied from backend/prisma/migrations/20260903_facility_storage_topology. Prisma still owns
    // this table, and the transitional wms.facility view reads it.
    private const string PrismaFacilityTable = """
        CREATE TABLE "Facility" (
            "id" TEXT NOT NULL,
            "orgId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "code" TEXT,
            "sourceLocationId" TEXT,
            "address1" TEXT,
            "address2" TEXT,
            "city" TEXT,
            "state" TEXT,
            "postalCode" TEXT,
            "country" TEXT,
            "timezone" TEXT,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "archived" BOOLEAN NOT NULL DEFAULT false,
            "archivedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
        );
        """;

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:16-alpine").Build();

    public string ConnectionString => _container.GetConnectionString();

    public NpgsqlDataSource DataSource { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        await _container.StartAsync();
        DataSource = NpgsqlDataSource.Create(ConnectionString);

        await using (var connection = await DataSource.OpenConnectionAsync())
        {
            await connection.ExecuteAsync(PrismaFacilityTable);
        }

        Migrator.Run(ConnectionString, typeof(Program).Assembly, NullLogger.Instance);
    }

    public async ValueTask DisposeAsync()
    {
        await DataSource.DisposeAsync();
        await _container.DisposeAsync();
    }

    /// <summary>Writes a facility the way Prisma would, as the table owner.</summary>
    public async Task<string> InsertFacilityAsync(
        string orgId, string name, bool active = true, bool archived = false, string? city = null)
    {
        var id = Guid.NewGuid().ToString();
        await using var connection = await DataSource.OpenConnectionAsync();
        await connection.ExecuteAsync(
            """
            INSERT INTO "Facility" ("id", "orgId", "name", "code", "city", "active", "archived", "updatedAt")
            VALUES (@Id, @OrgId, @Name, @Code, @City, @Active, @Archived, now())
            """,
            new { Id = id, OrgId = orgId, Name = name, Code = name[..Math.Min(4, name.Length)].ToUpperInvariant(), City = city, Active = active, Archived = archived });
        return id;
    }

    public static string NewOrgId() => Guid.NewGuid().ToString();
}
