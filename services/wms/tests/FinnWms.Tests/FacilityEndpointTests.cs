using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace FinnWms.Tests;

public sealed class FacilityEndpointTests(DatabaseFixture db) : IAsyncDisposable
{
    private readonly WmsApiFactory _factory = new(db);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    private async Task<(HttpStatusCode Status, JsonElement Body)> GetAsync(string path, string? token)
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await client.SendAsync(request, Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);
        var body = text.Length == 0 ? default : JsonDocument.Parse(text).RootElement.Clone();
        return (response.StatusCode, body);
    }

    [Fact]
    public async Task List_returns_the_callers_facilities_in_the_envelope()
    {
        var org = DatabaseFixture.NewOrgId();
        await db.InsertFacilityAsync(org, "Leeds", city: "Leeds");
        await db.InsertFacilityAsync(DatabaseFixture.NewOrgId(), "Bristol");

        var (status, body) = await GetAsync("/api/v1/facilities", TestTokens.Mint(org));

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(JsonValueKind.Null, body.GetProperty("error").ValueKind);
        var facility = Assert.Single(body.GetProperty("data").EnumerateArray());
        Assert.Equal("Leeds", facility.GetProperty("name").GetString());
        Assert.Equal("Leeds", facility.GetProperty("address").GetProperty("city").GetString());
        Assert.Equal(JsonValueKind.Null, facility.GetProperty("sourceLocationId").ValueKind);
        var meta = body.GetProperty("meta");
        Assert.Equal(1, meta.GetProperty("page").GetInt32());
        Assert.Equal(50, meta.GetProperty("perPage").GetInt32());
        Assert.Equal(1, meta.GetProperty("total").GetInt64());
    }

    [Theory]
    [InlineData("wms:read")]
    [InlineData("wms:*")]
    [InlineData("*")]
    public async Task List_accepts_any_grant_that_covers_wms_read(string permission)
    {
        var (status, _) = await GetAsync("/api/v1/facilities", TestTokens.Mint(DatabaseFixture.NewOrgId(), [permission]));

        Assert.Equal(HttpStatusCode.OK, status);
    }

    [Fact]
    public async Task Get_returns_a_facility_and_misses_another_orgs()
    {
        var org = DatabaseFixture.NewOrgId();
        var mine = await db.InsertFacilityAsync(org, "Leeds");
        var theirs = await db.InsertFacilityAsync(DatabaseFixture.NewOrgId(), "Bristol");
        var token = TestTokens.Mint(org);

        var (okStatus, okBody) = await GetAsync($"/api/v1/facilities/{mine}", token);
        var (missStatus, missBody) = await GetAsync($"/api/v1/facilities/{theirs}", token);

        Assert.Equal(HttpStatusCode.OK, okStatus);
        Assert.Equal(mine, okBody.GetProperty("data").GetProperty("id").GetString());
        Assert.Equal(HttpStatusCode.NotFound, missStatus);
        Assert.Equal("Facility not found", missBody.GetProperty("error").GetString());
    }

    [Theory]
    [InlineData("/api/v1/facilities/not-a-uuid")]
    [InlineData("/api/v1/facilities?perPage=101")]
    [InlineData("/api/v1/facilities?page=0")]
    public async Task Bad_input_is_a_400_envelope(string path)
    {
        var (status, body) = await GetAsync(path, TestTokens.Mint(DatabaseFixture.NewOrgId()));

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal(JsonValueKind.Null, body.GetProperty("data").ValueKind);
        Assert.False(string.IsNullOrEmpty(body.GetProperty("error").GetString()));
    }

    [Fact]
    public async Task The_inventory_app_session_can_list_facilities_to_pick_its_site()
    {
        var (status, _) = await GetAsync("/api/v1/facilities", TestTokens.Mint(DatabaseFixture.NewOrgId(), scope: "inventory"));

        Assert.Equal(HttpStatusCode.OK, status);
    }

    public static TheoryData<string, string?> Unauthenticated => new()
    {
        { "no token", null },
        { "wrong issuer", TestTokens.Mint(DatabaseFixture.NewOrgId(), issuer: "open-tms-carrier") },
        { "wrong secret", TestTokens.Mint(DatabaseFixture.NewOrgId(), secret: "another-secret-that-is-also-thirty-two-bytes") },
        { "expired", TestTokens.Mint(DatabaseFixture.NewOrgId(), expiresIn: TimeSpan.FromMinutes(-1)) },
        { "no organisation", TestTokens.Mint(orgId: null) },
    };

    [Theory]
    [MemberData(nameof(Unauthenticated))]
    public async Task Unauthenticated_requests_are_a_401_envelope(string because, string? token)
    {
        var (status, body) = await GetAsync("/api/v1/facilities", token);

        Assert.True(status == HttpStatusCode.Unauthorized, because);
        Assert.Equal(JsonValueKind.Null, body.GetProperty("data").ValueKind);
    }

    public static TheoryData<string, string> Forbidden => new()
    {
        { "warehouse session", TestTokens.Mint(DatabaseFixture.NewOrgId(), scope: "warehouse") },
        { "inventory session without wms:read", TestTokens.Mint(DatabaseFixture.NewOrgId(), ["inventory:read"], scope: "inventory") },
        { "no wms permission", TestTokens.Mint(DatabaseFixture.NewOrgId(), ["shipments:read"]) },
    };

    [Theory]
    [MemberData(nameof(Forbidden))]
    public async Task Sessions_without_the_grant_are_a_403_envelope(string because, string token)
    {
        var (status, body) = await GetAsync("/api/v1/facilities", token);

        Assert.True(status == HttpStatusCode.Forbidden, because);
        Assert.Equal("Insufficient permissions", body.GetProperty("error").GetString());
    }
}
