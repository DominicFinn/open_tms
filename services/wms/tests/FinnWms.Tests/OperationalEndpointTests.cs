using System.Net;

namespace FinnWms.Tests;

public sealed class OperationalEndpointTests(DatabaseFixture db) : IAsyncDisposable
{
    private readonly WmsApiFactory _factory = new(db);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    [Fact]
    public async Task Health_reports_healthy_with_the_database_up()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Metrics_are_served_in_prometheus_format()
    {
        using var client = _factory.CreateClient();
        using var warmUp = await client.GetAsync(new Uri("/api/v1/facilities", UriKind.Relative), Ct);

        using var response = await client.GetAsync(new Uri("/metrics", UriKind.Relative), Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("# TYPE", text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Every_response_carries_the_security_headers()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/api/v1/facilities", UriKind.Relative), Ct);

        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Contains("max-age=31536000", response.Headers.GetValues("Strict-Transport-Security").Single(), StringComparison.Ordinal);
        Assert.Equal("strict-origin-when-cross-origin", response.Headers.GetValues("Referrer-Policy").Single());
    }
}
