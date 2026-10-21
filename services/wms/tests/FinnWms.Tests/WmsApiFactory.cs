using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace FinnWms.Tests;

public sealed class WmsApiFactory(DatabaseFixture database) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Wms", database.ConnectionString);
        builder.UseSetting("JWT_SECRET", TestTokens.Secret);
        builder.UseSetting("Wms:MigrateOnStartup", "false");
    }
}
