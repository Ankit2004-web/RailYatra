using System.Globalization;
using System.Text.RegularExpressions;

namespace RailYatra.Infrastructure.Etl;

public static partial class RailwayNormalizer
{
    public static string? NormalizeCode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return value.Trim().ToUpperInvariant();
    }

    public static string? NormalizeName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var s = Regex.Replace(value.Trim(), @"\s+", " ");
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(s.ToLowerInvariant());
    }

    public static string? NormalizeTrainNumber(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return Regex.Replace(value.Trim(), @"\D", "");
    }

    public static string? NormalizeTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Equals("none", StringComparison.OrdinalIgnoreCase))
            return null;
        var t = value.Trim();
        if (TimeSpan.TryParse(t, out var ts))
            return ts.ToString(@"hh\:mm", CultureInfo.InvariantCulture);
        if (t.Length >= 5 && TimeSpan.TryParse(t[..5], out ts))
            return ts.ToString(@"hh\:mm", CultureInfo.InvariantCulture);
        return null;
    }

    public static int? ParseInt(string? value)
        => int.TryParse(value, out var n) ? n : null;

    public static int? HaltMinutes(string? arrival, string? departure)
    {
        if (string.IsNullOrWhiteSpace(arrival) || string.IsNullOrWhiteSpace(departure)) return null;
        if (!TimeSpan.TryParse(arrival, out var a) || !TimeSpan.TryParse(departure, out var d)) return null;
        var diff = (int)(d - a).TotalMinutes;
        if (diff < 0) diff += 1440;
        return diff >= 0 ? diff : null;
    }

    public static string MapTrainTypeCode(string? raw)
    {
        var key = Regex.Replace(raw ?? "", @"[^a-z]", "", RegexOptions.IgnoreCase).ToLowerInvariant();
        return key switch
        {
            "raj" or "rajdhani" => "RAJ",
            "shat" or "shatabdi" => "SHAT",
            "dur" or "duronto" => "DUR",
            "vb" or "vandebharat" => "VB",
            "sf" or "superfast" => "SF",
            "pass" or "passgr" or "passenger" => "PASS",
            "mail" or "exp" or "express" => "EXP",
            _ => "EXP"
        };
    }

    public static int? JourneyMinutes(string? dep, string? arr, int durationH, int durationM)
    {
        if (durationH > 0 || durationM > 0) return durationH * 60 + durationM;
        if (string.IsNullOrWhiteSpace(dep) || string.IsNullOrWhiteSpace(arr)) return null;
        if (!TimeSpan.TryParse(dep, out var d) || !TimeSpan.TryParse(arr, out var a)) return null;
        var diff = (int)(a - d).TotalMinutes;
        return diff >= 0 ? diff : diff + 1440;
    }
}
