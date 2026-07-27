using RailYatra.Infrastructure.Etl;

namespace RailYatra.Tests;

public class RailwayNormalizerTests
{
    [Theory]
    [InlineData("NDLS", "NDLS")]
    [InlineData(" ndls ", "NDLS")]
    public void NormalizeCode_TrimsAndUppercases(string input, string expected)
        => Assert.Equal(expected, RailwayNormalizer.NormalizeCode(input));

    [Theory]
    [InlineData("12345", "12345")]
    [InlineData("01234A", "01234")]
    public void NormalizeTrainNumber_StripsNonDigits(string input, string expected)
        => Assert.Equal(expected, RailwayNormalizer.NormalizeTrainNumber(input));

    [Theory]
    [InlineData("14:30", "14:30")]
    [InlineData("none", null)]
    public void NormalizeTime_ParsesOrNull(string input, string? expected)
        => Assert.Equal(expected, RailwayNormalizer.NormalizeTime(input));

    [Theory]
    [InlineData("raj", "RAJ")]
    [InlineData("superfast", "SF")]
    [InlineData("passenger", "PASS")]
    public void MapTrainTypeCode_MapsKnownTypes(string input, string expected)
        => Assert.Equal(expected, RailwayNormalizer.MapTrainTypeCode(input));

    [Fact]
    public void HaltMinutes_ComputesDifference()
        => Assert.Equal(10, RailwayNormalizer.HaltMinutes("10:00", "10:10"));

    [Fact]
    public void JourneyMinutes_UsesDurationWhenPresent()
        => Assert.Equal(510, RailwayNormalizer.JourneyMinutes(null, null, 8, 30));
}
