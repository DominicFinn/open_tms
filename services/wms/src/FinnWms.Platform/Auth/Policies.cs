namespace FinnWms.Platform.Auth;

public static class Policies
{
    /// <summary>Read WMS data from an unrestricted session.</summary>
    public const string WmsRead = "wms:read";

    /// <summary>Change WMS data from an unrestricted session.</summary>
    public const string WmsWrite = "wms:write";
}
