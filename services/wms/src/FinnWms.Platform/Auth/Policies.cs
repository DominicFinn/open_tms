namespace FinnWms.Platform.Auth;

public static class Policies
{
    /// <summary>Read WMS data from an unrestricted session.</summary>
    public const string WmsRead = "wms:read";

    /// <summary>
    /// Read WMS data from an unrestricted session or the inventory app's narrower one, which picks
    /// its facility and reads stock levels (#233, #297).
    /// </summary>
    public const string WmsReadForInventoryApp = "wms:read+inventory-app";

    /// <summary>Change WMS data from an unrestricted session.</summary>
    public const string WmsWrite = "wms:write";
}
