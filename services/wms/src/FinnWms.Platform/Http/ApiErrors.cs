using Microsoft.AspNetCore.Http;

namespace FinnWms.Platform.Http;

public static class ApiErrors
{
    public static IResult Result(int statusCode, string message) =>
        Results.Json(new ErrorEnvelope(null, message), statusCode: statusCode);

    public static Task WriteAsync(HttpResponse response, int statusCode, string message)
    {
        ArgumentNullException.ThrowIfNull(response);
        response.StatusCode = statusCode;
        return response.WriteAsJsonAsync(new ErrorEnvelope(null, message));
    }
}
