using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace FinnWms.Tests;

/// <summary>
/// Mints tokens byte for byte the way the Node backend does (backend/src/auth/internalJWT.ts),
/// so the tests prove the .NET side accepts what core auth actually issues.
/// </summary>
public static class TestTokens
{
    public const string Secret = "test-secret-that-is-at-least-thirty-two-bytes-long";

    public static string Mint(
        string? orgId,
        string[]? permissions = null,
        string? scope = null,
        string issuer = "open-tms-auth",
        TimeSpan? expiresIn = null,
        string secret = Secret)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var payload = new Dictionary<string, object?>
        {
            ["sub"] = "user-1",
            ["email"] = "operator@example.test",
            ["roles"] = new[] { "admin" },
            ["permissions"] = permissions ?? ["wms:read"],
            ["iat"] = now,
            ["exp"] = now + (long)(expiresIn ?? TimeSpan.FromHours(12)).TotalSeconds,
            ["iss"] = issuer,
        };
        if (orgId is not null)
        {
            payload["organizationId"] = orgId;
        }

        if (scope is not null)
        {
            payload["scope"] = scope;
        }

        var header = Base64Url("""{"alg":"HS256","typ":"JWT"}"""u8.ToArray());
        var body = Base64Url(JsonSerializer.SerializeToUtf8Bytes(payload));
        var signature = Base64Url(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{header}.{body}")));
        return $"{header}.{body}.{signature}";
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
