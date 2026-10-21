using System.Reflection;
using System.Text.Json.Serialization;
using FinnWms.Platform.Auth;
using FinnWms.Platform.Data;
using FinnWms.Platform.Http;
using FinnWms.Platform.Observability;
using FinnWms.Wms;

// The build runs this entry point to write openapi/finnwms.json. That run has no database or
// secrets, and never serves a request, so it uses the development defaults.
var generatingOpenApi = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    EnvironmentName = generatingOpenApi ? Environments.Development : null,
});

var connectionString = builder.Configuration.GetConnectionString("Wms")
    ?? throw new InvalidOperationException("ConnectionStrings__Wms is required");

if (args is ["migrate"])
{
    using var loggerFactory = LoggerFactory.Create(logging => logging.AddSimpleConsole());
    Migrator.Run(
        builder.Configuration.GetConnectionString("WmsMigrations") ?? connectionString,
        typeof(Program).Assembly,
        loggerFactory.CreateLogger("FinnWms.Migrations"));
    return;
}

if (!builder.Environment.IsDevelopment())
{
    builder.Logging.ClearProviders();
    builder.Logging.AddJsonConsole();
}

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);
builder.Services.AddWmsData(connectionString);
builder.Services.AddInternalJwtAuth(builder.Configuration, builder.Environment);
builder.Services.AddWmsRateLimiting(builder.Configuration.GetValue("Wms:RateLimitPerMinute", 600));
builder.Services.AddWmsObservability(builder.Configuration);
builder.Services.AddOpenApi(options => options.AddDocumentTransformer((document, _, _) =>
{
    document.Info.Title = "FinnWMS API";
    document.Info.Version = "v1";
    return Task.CompletedTask;
}));
builder.Services.AddWmsModule();

var app = builder.Build();

if (!generatingOpenApi && app.Configuration.GetValue("Wms:MigrateOnStartup", false))
{
    Migrator.Run(
        app.Configuration.GetConnectionString("WmsMigrations") ?? connectionString,
        typeof(Program).Assembly,
        app.Logger);
}

app.UseEnvelopeExceptionHandler();
app.UseSecurityHeaders();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGroup(string.Empty)
    .RequireRateLimiting(HttpApplicationBuilderExtensions.PerCallerPolicy)
    .MapWmsModule();

app.MapOperationalEndpoints();

await app.RunAsync();

public partial class Program;
