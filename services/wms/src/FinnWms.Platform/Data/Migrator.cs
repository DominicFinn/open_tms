using System.Reflection;
using Dapper;
using DbUp;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace FinnWms.Platform.Data;

/// <summary>
/// Runs the forward-only SQL migrations embedded in the host assembly under <c>migrations.</c>.
/// </summary>
/// <remarks>
/// Scripts run in name order, one transaction each, and are journalled in
/// <c>wms.schema_versions</c>. A script that has run is never edited; a fix is a new script.
/// Run this as a deploy step, or at startup in development. It takes no lock, so two replicas must
/// not run it at the same time.
/// </remarks>
public static partial class Migrator
{
    public const string ResourcePrefix = "migrations.";

    public static void Run(string connectionString, Assembly scriptsAssembly, ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(scriptsAssembly);
        ArgumentNullException.ThrowIfNull(logger);

        // The journal lives in the schema, so the schema has to exist before DbUp starts.
        using (var connection = new NpgsqlConnection(connectionString))
        {
            connection.Open();
            connection.Execute("CREATE SCHEMA IF NOT EXISTS wms");
        }

        var upgrader = DeployChanges.To
            .PostgresqlDatabase(connectionString)
            .WithScriptsEmbeddedInAssembly(
                scriptsAssembly, name => name.StartsWith(ResourcePrefix, StringComparison.Ordinal))
            .JournalToPostgresqlTable("wms", "schema_versions")
            .WithTransactionPerScript()
            .LogToNowhere()
            .Build();

        var result = upgrader.PerformUpgrade();
        if (!result.Successful)
        {
            throw new MigrationFailedException(result.ErrorScript?.Name, result.Error);
        }

        var applied = result.Scripts.ToList();
        foreach (var script in applied)
        {
            LogApplied(logger, script.Name);
        }

        LogFinished(logger, applied.Count);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Migration applied {Script}")]
    private static partial void LogApplied(ILogger logger, string script);

    [LoggerMessage(Level = LogLevel.Information, Message = "Migrations finished, {Count} applied")]
    private static partial void LogFinished(ILogger logger, int count);
}

public sealed class MigrationFailedException(string? script, Exception? inner)
    : Exception($"Migration {script ?? "(unknown)"} failed", inner)
{
    public string? Script { get; } = script;
}
