namespace VibeTime.Api.Models;

public sealed record Employee(
    Guid Id,
    string LastName,
    string FirstName,
    string? MiddleName,
    string Email,
    DateTimeOffset CreatedAt);
