using System.Text.Json;
using Dapper;
using FinnWms.Platform.Data;

namespace FinnWms.Platform.Events;

/// <summary>An event a command emits, in the shape Node's event bus expects (ADR 0006).</summary>
/// <param name="Type">Event type, e.g. <c>handling_unit.moved</c>. Must exist in Node's eventTypes.ts.</param>
/// <param name="SchemaVersion">The event type's schema version, as in Node's EVENT_SCHEMA_VERSIONS.</param>
public sealed record OutboxEvent(
    string Type,
    string EntityType,
    string EntityId,
    object Payload,
    int SchemaVersion,
    string? ActorId,
    string CorrelationId,
    string? CausationId = null);

/// <summary>
/// Writes events to <c>wms.outbox</c> inside the command's transaction, so they commit or roll back
/// with its change. The Node relay delivers them to Node's event bus (ADR 0006).
/// </summary>
public sealed class Outbox
{
    public const string Source = "finnwms";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Adds the event to the session's transaction and returns its id.</summary>
    public async Task<string> EnqueueAsync(TenantSession session, OutboxEvent evt, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(session);
        ArgumentNullException.ThrowIfNull(evt);

        var id = Guid.NewGuid().ToString();
        var metadata = new Dictionary<string, object?>
        {
            ["correlationId"] = evt.CorrelationId,
            ["source"] = Source,
            ["schemaVersion"] = evt.SchemaVersion,
        };
        if (evt.CausationId is not null)
        {
            metadata["causationId"] = evt.CausationId;
        }

        await session.Connection.ExecuteAsync(new CommandDefinition(
            """
            INSERT INTO wms.outbox (id, type, org_id, actor_id, entity_type, entity_id, payload, metadata)
            VALUES (@Id, @Type, @OrgId, @ActorId, @EntityType, @EntityId, @Payload::jsonb, @Metadata::jsonb)
            """,
            new
            {
                Id = id,
                evt.Type,
                session.OrgId,
                evt.ActorId,
                evt.EntityType,
                evt.EntityId,
                Payload = JsonSerializer.Serialize(evt.Payload, Json),
                Metadata = JsonSerializer.Serialize(metadata, Json),
            },
            session.Transaction,
            cancellationToken: cancellationToken));

        return id;
    }
}
