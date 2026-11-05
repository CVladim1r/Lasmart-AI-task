namespace VibeTime.Api.Models;

public sealed record CreateEmployeeRequest(
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string? Email,
    string? Password,
    string? ConfirmPassword);

public sealed record UpdateEmployeeRequest(
    string? LastName,
    string? FirstName,
    string? MiddleName,
    string? Email,
    string? Password,
    string? ConfirmPassword);

public sealed record LoginRequest(string? Email, string? Password);
