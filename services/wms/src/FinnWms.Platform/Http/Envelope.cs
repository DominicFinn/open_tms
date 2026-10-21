namespace FinnWms.Platform.Http;

/// <summary>The API envelope every response uses: <c>{ data, error }</c>.</summary>
public sealed record Envelope<T>(T? Data, string? Error);

public sealed record PageMeta(int Page, int PerPage, long Total);

/// <summary>A page of a list: <c>{ data, meta: { page, perPage, total }, error }</c>.</summary>
public sealed record PagedEnvelope<T>(IReadOnlyList<T> Data, PageMeta Meta, string? Error);

public sealed record ErrorEnvelope(object? Data, string Error);
